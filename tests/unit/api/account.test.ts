import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/session.js", () => ({
  authenticateAccessToken: vi.fn(),
}));
vi.mock("../../../src/db/queries/account-lifecycle.js", () => ({
  buildCreatorExport: vi.fn(),
  requestAccountDeletion: vi.fn(),
  getAccountDeletion: vi.fn(),
  getAccountDeletionByToken: vi.fn(),
  getAccountDeletionOwnerByToken: vi.fn(),
}));
vi.mock("../../../src/jobs/account-deletion.js", () => ({
  enqueueAccountDeletion: vi.fn(),
  retryAccountDeletion: vi.fn(),
}));

import { Hono } from "hono";
import { authenticateAccessToken } from "../../../src/auth/session.js";
import {
  buildCreatorExport,
  getAccountDeletionByToken,
  getAccountDeletionOwnerByToken,
  requestAccountDeletion,
} from "../../../src/db/queries/account-lifecycle.js";
import {
  enqueueAccountDeletion,
  retryAccountDeletion,
} from "../../../src/jobs/account-deletion.js";
import { account } from "../../../src/api/routes/account.js";
import { env } from "../../../src/config/env.js";

describe("account API", () => {
  const app = new Hono().route("/account", account);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      accessToken: "token",
      creatorId: "creator-1",
      privyUserId: "did:privy:user-1",
    });
  });

  it("exports only the authenticated creator with no-store download headers", async () => {
    vi.mocked(buildCreatorExport).mockResolvedValue({
      exportedAt: "2026-07-11T00:00:00.000Z",
      creator: { id: "creator-1", display_name: "Creator" },
      deals: [{ id: "deal-1", creator_id: "creator-1" }],
      transactions: [],
      paymentAttempts: [],
      messages: [],
      actions: [],
      memories: [],
      outcomes: [],
      connections: [{ platform: "youtube", connected: true }],
    } as never);

    const response = await app.request("/account/export", {
      headers: { Authorization: "Bearer token" },
    });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(buildCreatorExport).toHaveBeenCalledWith("creator-1");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(text).not.toMatch(
      /access_token|refresh_token|wallet_id|private_key/i,
    );
    expect(text).not.toContain("creator-2");
  });

  it("requires the exact destructive confirmation phrase", async () => {
    for (const confirmation of ["delete", "DELETE MY ACCOUNT ", ""]) {
      const response = await app.request("/account", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation }),
      });
      expect(response.status).toBe(400);
    }
    expect(requestAccountDeletion).not.toHaveBeenCalled();
  });

  it("idempotently requests deletion and enqueues deterministic cleanup", async () => {
    vi.mocked(requestAccountDeletion).mockResolvedValue({
      creatorId: "creator-1",
      state: "requested",
      residuals: [],
      receiptToken: "raw-receipt-token",
      receiptExpiresAt: "2026-07-12T00:00:00.000Z",
    } as never);
    vi.mocked(enqueueAccountDeletion).mockResolvedValue(undefined);

    const request = () =>
      app.request("/account", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
      });
    const first = await request();
    expect(first.status).toBe(202);
    const firstBody = await first.json();
    expect(firstBody).toMatchObject({
      sessionEnds: false,
      receiptToken: "raw-receipt-token",
    });
    expect(firstBody.creatorId).toBeUndefined();
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect((await request()).status).toBe(202);
    expect(enqueueAccountDeletion).toHaveBeenCalledWith("creator-1");
  });

  it("fails closed before marking deletion when job workers are disabled", async () => {
    const original = env.ENABLE_JOBS;
    env.ENABLE_JOBS = false;
    try {
      const response = await app.request("/account", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
      });
      expect(response.status).toBe(503);
      expect(requestAccountDeletion).not.toHaveBeenCalled();
      expect(enqueueAccountDeletion).not.toHaveBeenCalled();
    } finally {
      env.ENABLE_JOBS = original;
    }
  });

  it("polls completion after auth is gone using only an opaque receipt", async () => {
    vi.mocked(getAccountDeletionByToken).mockResolvedValue({
      state: "completed",
      residuals: [
        {
          kind: "on-chain-address",
          identifier: "0xabc",
          detail: "Public chain",
        },
      ],
    } as never);
    const response = await app.request("/account/deletion/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptToken: "opaque-user-one" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      state: "completed",
      sessionEnds: true,
    });
    expect(getAccountDeletionByToken).toHaveBeenCalledWith("opaque-user-one");
    expect(authenticateAccessToken).not.toHaveBeenCalled();
  });

  it("does not leak lifecycle state for an invalid or other-user receipt", async () => {
    vi.mocked(getAccountDeletionByToken).mockResolvedValue(null);
    const response = await app.request("/account/deletion/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptToken: "other-user-token" }),
    });
    expect(response.status).toBe(404);
  });

  it("retries a failed cleanup using the receipt-resolved owner only", async () => {
    vi.mocked(getAccountDeletionByToken).mockResolvedValue({
      state: "retryable-failure",
      residuals: [],
    });
    vi.mocked(getAccountDeletionOwnerByToken).mockResolvedValue("creator-1");
    vi.mocked(retryAccountDeletion).mockResolvedValue(undefined);
    const response = await app.request("/account/deletion/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptToken: "opaque" }),
    });
    expect(response.status).toBe(202);
    expect(retryAccountDeletion).toHaveBeenCalledWith("creator-1");
    expect(JSON.stringify(await response.json())).not.toContain("creator-1");
  });
});
