import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/session.js", () => ({
  authenticateAccessToken: vi.fn(),
}));

vi.mock("../../../src/db/queries/creators.js", () => ({
  createCreator: vi.fn(),
  getCreatorById: vi.fn(),
  getCreatorByPrivyUserId: vi.fn(),
  updateCreator: vi.fn(),
}));

vi.mock("../../../src/wallet/provisioning.js", () => ({
  ensureCreatorWalletProvisioning: vi.fn(),
  getWalletOnboardingMetadata: vi.fn(
    (
      creator: {
        wallet_id?: string | null;
        wallet_address?: string | null;
        settings?: Record<string, unknown> | null;
      } | null,
    ) => {
      if (!creator) {
        return {
          status: "unregistered",
          walletProvisioned: false,
          walletProvisioningInProgress: false,
          walletProvisioningAttempts: 0,
          walletProvisioningLastError: null,
        };
      }

      return {
        status:
          creator.wallet_id && creator.wallet_address
            ? "active"
            : typeof creator.settings?.onboarding_status === "string"
              ? creator.settings.onboarding_status
              : "wallet_pending",
        walletProvisioned: Boolean(creator.wallet_id && creator.wallet_address),
        walletProvisioningInProgress:
          creator.settings?.wallet_provisioning_in_progress === true,
        walletProvisioningAttempts:
          typeof creator.settings?.wallet_provisioning_attempts === "number"
            ? creator.settings.wallet_provisioning_attempts
            : 0,
        walletProvisioningLastError:
          typeof creator.settings?.onboarding_error === "string"
            ? creator.settings.onboarding_error
            : null,
      };
    },
  ),
}));

import { Hono } from "hono";
import { authenticateAccessToken } from "../../../src/auth/session.js";
import {
  createCreator,
  getCreatorById,
  getCreatorByPrivyUserId,
  updateCreator,
} from "../../../src/db/queries/creators.js";
import { ensureCreatorWalletProvisioning } from "../../../src/wallet/provisioning.js";
import { auth } from "../../../src/api/routes/auth.js";

describe("auth API", () => {
  const app = new Hono();
  app.route("/auth", auth);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createCreator).mockReset();
    vi.mocked(getCreatorById).mockReset();
    vi.mocked(getCreatorByPrivyUserId).mockReset();
    vi.mocked(updateCreator).mockReset();
    vi.mocked(ensureCreatorWalletProvisioning).mockReset();
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      creatorId: null,
      privyUserId: "did:privy:user-1",
    });
  });

  it("GET /auth/me returns an unregistered onboarding state when no creator exists", async () => {
    vi.mocked(getCreatorByPrivyUserId).mockResolvedValue(null);

    const response = await app.request("/auth/me", {
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.creator).toBeNull();
    expect(body.onboarding.status).toBe("unregistered");
  });

  it("POST /auth/register is idempotent for the authenticated Privy user", async () => {
    const creator = {
      id: "creator-1",
      privy_user_id: "did:privy:user-1",
      display_name: "Ada",
      niche: "tech",
      wallet_id: "wallet-1",
      wallet_address: "0x123",
      settings: {},
    };
    vi.mocked(getCreatorByPrivyUserId).mockResolvedValue(creator as never);

    const response = await app.request("/auth/register", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: "Ada", niche: "tech" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.isNew).toBe(false);
    expect(body.creator.id).toBe("creator-1");
    expect(createCreator).not.toHaveBeenCalled();
    expect(ensureCreatorWalletProvisioning).not.toHaveBeenCalled();
  });

  it("POST /auth/register creates a creator and starts wallet provisioning asynchronously", async () => {
    vi.mocked(getCreatorByPrivyUserId).mockResolvedValueOnce(null);
    vi.mocked(createCreator).mockResolvedValue({
      id: "creator-2",
      privy_user_id: "did:privy:user-1",
      display_name: "Bola",
      niche: "finance",
      wallet_id: null,
      wallet_address: null,
      settings: { onboarding_status: "wallet_pending" },
    } as never);
    vi.mocked(ensureCreatorWalletProvisioning).mockResolvedValue({
      started: true,
      creator: null,
      reason: "started",
    } as never);
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-2",
      privy_user_id: "did:privy:user-1",
      display_name: "Bola",
      niche: "finance",
      wallet_id: null,
      wallet_address: null,
      settings: { onboarding_status: "wallet_pending" },
    } as never);

    const response = await app.request("/auth/register", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: "Bola", niche: "finance" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.isNew).toBe(true);
    expect(body.onboarding.status).toBe("wallet_pending");
    expect(body.onboarding.walletProvisioned).toBe(false);
    expect(ensureCreatorWalletProvisioning).toHaveBeenCalledWith("creator-2", {
      force: true,
      source: "dashboard_register",
    });
  });

  it("GET /auth/me returns 503 when creator resolution failed during auth", async () => {
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      creatorId: null,
      creatorResolutionError: new Error(
        "Creator service is temporarily unavailable. Please retry in a moment.",
      ),
      privyUserId: "did:privy:user-1",
    } as never);

    const response = await app.request("/auth/me", {
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("Creator service is temporarily unavailable");
    expect(getCreatorByPrivyUserId).not.toHaveBeenCalled();
  });

  it("POST /auth/register returns 503 when creator resolution failed during auth", async () => {
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      creatorId: null,
      creatorResolutionError: new Error(
        "Creator service is temporarily unavailable. Please retry in a moment.",
      ),
      privyUserId: "did:privy:user-1",
    } as never);

    const response = await app.request("/auth/register", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: "Ada", niche: "tech" }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain("Creator service is temporarily unavailable");
    expect(createCreator).not.toHaveBeenCalled();
  });

  it("POST /auth/register creates a separate creator for a different Privy user", async () => {
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      creatorId: null,
      privyUserId: "did:privy:user-2",
    });
    vi.mocked(getCreatorByPrivyUserId).mockResolvedValueOnce(null);
    vi.mocked(createCreator).mockResolvedValue({
      id: "creator-5",
      privy_user_id: "did:privy:user-2",
      display_name: "Efe",
      niche: "fashion",
      wallet_id: null,
      wallet_address: null,
      settings: { onboarding_status: "wallet_pending" },
    } as never);
    vi.mocked(ensureCreatorWalletProvisioning).mockResolvedValue({
      started: true,
      creator: null,
      reason: "started",
    } as never);
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-5",
      privy_user_id: "did:privy:user-2",
      display_name: "Efe",
      niche: "fashion",
      wallet_id: null,
      wallet_address: null,
      settings: { onboarding_status: "wallet_pending" },
    } as never);

    const response = await app.request("/auth/register", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token-user-2",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: "Efe", niche: "fashion" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.creator.privy_user_id).toBe("did:privy:user-2");
    expect(createCreator).toHaveBeenCalledWith(
      expect.objectContaining({
        privy_user_id: "did:privy:user-2",
        display_name: "Efe",
      }),
    );
    expect(ensureCreatorWalletProvisioning).toHaveBeenCalledWith("creator-5", {
      force: true,
      source: "dashboard_register",
    });
  });

  it("POST /auth/register recovers cleanly when a duplicate creator is created concurrently", async () => {
    vi.mocked(getCreatorByPrivyUserId)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "creator-6",
        privy_user_id: "did:privy:user-1",
        display_name: "Ada",
        niche: "tech",
        wallet_id: null,
        wallet_address: null,
        settings: { onboarding_status: "wallet_pending" },
      } as never);
    vi.mocked(createCreator).mockRejectedValue({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });
    vi.mocked(ensureCreatorWalletProvisioning).mockResolvedValue({
      started: true,
      creator: null,
      reason: "started",
    } as never);
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-6",
      privy_user_id: "did:privy:user-1",
      display_name: "Ada",
      niche: "tech",
      wallet_id: null,
      wallet_address: null,
      settings: { onboarding_status: "wallet_pending" },
    } as never);

    const response = await app.request("/auth/register", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: "Ada", niche: "tech" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.isNew).toBe(false);
    expect(body.creator.id).toBe("creator-6");
    expect(ensureCreatorWalletProvisioning).toHaveBeenCalledWith("creator-6", {
      force: false,
      source: "dashboard_register",
    });
  });

  it("GET /auth/me resumes wallet provisioning for pending creators", async () => {
    vi.mocked(getCreatorByPrivyUserId).mockResolvedValue({
      id: "creator-3",
      privy_user_id: "did:privy:user-1",
      display_name: "Caro",
      niche: "gaming",
      wallet_id: null,
      wallet_address: null,
      settings: { onboarding_status: "wallet_pending" },
    } as never);
    vi.mocked(ensureCreatorWalletProvisioning).mockResolvedValue({
      started: true,
      creator: null,
      reason: "started",
    } as never);
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-3",
      privy_user_id: "did:privy:user-1",
      display_name: "Caro",
      niche: "gaming",
      wallet_id: null,
      wallet_address: null,
      settings: {
        onboarding_status: "wallet_pending",
        wallet_provisioning_in_progress: true,
      },
    } as never);

    const response = await app.request("/auth/me", {
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.onboarding.status).toBe("wallet_pending");
    expect(ensureCreatorWalletProvisioning).toHaveBeenCalledWith("creator-3", {
      force: false,
      source: "dashboard_session_sync",
    });
  });

  it("POST /auth/me/wallet/retry forces wallet provisioning for the authenticated creator", async () => {
    vi.mocked(getCreatorByPrivyUserId).mockResolvedValue({
      id: "creator-4",
      privy_user_id: "did:privy:user-1",
      display_name: "Dami",
      niche: "beauty",
      wallet_id: null,
      wallet_address: null,
      settings: { onboarding_status: "wallet_pending" },
    } as never);
    vi.mocked(ensureCreatorWalletProvisioning).mockResolvedValue({
      started: true,
      creator: null,
      reason: "started",
    } as never);
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-4",
      privy_user_id: "did:privy:user-1",
      display_name: "Dami",
      niche: "beauty",
      wallet_id: null,
      wallet_address: null,
      settings: {
        onboarding_status: "wallet_pending",
        wallet_provisioning_in_progress: true,
      },
    } as never);

    const response = await app.request("/auth/me/wallet/retry", {
      method: "POST",
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.onboarding.status).toBe("wallet_pending");
    expect(ensureCreatorWalletProvisioning).toHaveBeenCalledWith("creator-4", {
      force: true,
      source: "dashboard_manual_retry",
    });
  });

  it("PATCH /auth/me rejects an empty display name", async () => {
    vi.mocked(getCreatorByPrivyUserId).mockResolvedValue({
      id: "creator-7",
      privy_user_id: "did:privy:user-1",
      display_name: "Existing",
      niche: "tech",
      wallet_id: "wallet-1",
      wallet_address: "0x123",
      settings: {},
    } as never);

    const response = await app.request("/auth/me", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ displayName: "   " }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("displayName cannot be empty");
    expect(updateCreator).not.toHaveBeenCalled();
  });
});
