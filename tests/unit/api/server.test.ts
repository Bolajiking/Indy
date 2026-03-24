import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/session.js", () => ({
  authenticateAccessToken: vi.fn(),
}));

vi.mock("../../../src/db/queries/deals.js", () => ({
  getDealsForCreator: vi.fn(),
  getDealByIdForCreator: vi.fn(),
}));

vi.mock("../../../src/db/queries/transactions.js", () => ({
  getTransactionsForCreator: vi.fn(),
}));

import { authenticateAccessToken } from "../../../src/auth/session.js";
import { getDealByIdForCreator, getDealsForCreator } from "../../../src/db/queries/deals.js";
import { getTransactionsForCreator } from "../../../src/db/queries/transactions.js";
import { createApiServer } from "../../../src/api/server.js";
import { deals as dealsRoutes } from "../../../src/api/routes/deals.js";
import { wallet as walletRoutes } from "../../../src/api/routes/wallet.js";
import { webhooks } from "../../../src/api/routes/webhooks.js";

describe("API server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
    });
  });

  it("responds on /health", async () => {
    const app = createApiServer();

    const response = await app.request("/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeTruthy();
  });

  it("rejects unauthenticated creator-scoped deal access", async () => {
    const app = createApiServer();
    app.route("/api/deals", dealsRoutes);

    const response = await app.request("/api/deals");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Missing bearer token");
  });

  it("returns deals for the authenticated creator with optional stage filtering", async () => {
    vi.mocked(getDealsForCreator).mockResolvedValue([
      { id: "deal-1", brand_name: "Acme" } as never,
    ]);

    const app = createApiServer();
    app.route("/api/deals", dealsRoutes);

    const response = await app.request("/api/deals?stage=discovered", {
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getDealsForCreator).toHaveBeenCalledWith("creator-1", "discovered");
    expect(body).toHaveLength(1);
  });

  it("returns 503 for creator-scoped routes when creator resolution is temporarily unavailable", async () => {
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      creatorId: null,
      creatorResolutionError: new Error(
        "Creator service is temporarily unavailable. Please retry in a moment."
      ),
      privyUserId: "did:privy:creator-1",
    } as never);

    const app = createApiServer();
    app.route("/api/deals", dealsRoutes);

    const response = await app.request("/api/deals", {
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("Creator service is temporarily unavailable");
  });

  it("returns a single deal only within the authenticated creator scope", async () => {
    vi.mocked(getDealByIdForCreator).mockResolvedValue(null);

    const app = createApiServer();
    app.route("/api/deals", dealsRoutes);

    const response = await app.request("/api/deals/deal-404", {
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Not found");
    expect(getDealByIdForCreator).toHaveBeenCalledWith("creator-1", "deal-404");
  });

  it("returns wallet transactions for the authenticated creator with a limit", async () => {
    vi.mocked(getTransactionsForCreator).mockResolvedValue([]);

    const app = createApiServer();
    app.route("/api/wallet", walletRoutes);

    const response = await app.request("/api/wallet/transactions?limit=10", {
      headers: { Authorization: "Bearer access-token" },
    });

    expect(response.status).toBe(200);
    expect(getTransactionsForCreator).toHaveBeenCalledWith("creator-1", 10);
  });

  it("verifies the WhatsApp webhook handshake", async () => {
    const app = createApiServer();
    app.route("/webhooks", webhooks);

    const response = await app.request(
      "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=indyfren-verify&hub.challenge=12345"
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("12345");
  });

  it("rejects unsigned WhatsApp webhook deliveries", async () => {
    const app = createApiServer();
    app.route("/webhooks", webhooks);

    const response = await app.request("/webhooks/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ object: "whatsapp_business_account" }),
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Invalid WhatsApp signature");
  });
});
