import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/session.js", () => ({
  authenticateAccessToken: vi.fn(),
}));

vi.mock("../../../src/db/queries/deals.js", () => ({
  createDeal: vi.fn(),
  updateDeal: vi.fn(),
  getDealsForCreator: vi.fn(),
  getDealByIdForCreator: vi.fn(),
  updateDealStage: vi.fn(),
}));

vi.mock("../../../src/db/queries/transactions.js", () => ({
  getTransactionsForCreator: vi.fn(),
}));

vi.mock("../../../src/db/queries/payment-attempts.js", () => ({
  getPaymentAttemptsForCreator: vi.fn(),
}));

vi.mock("../../../src/db/queries/creators.js", () => ({
  getCreatorById: vi.fn(),
}));

vi.mock("../../../src/wallet/mpp.js", () => ({
  getOnChainBalance: vi.fn(),
  getOnChainBalanceWithTimeout: vi.fn(),
}));

import { authenticateAccessToken } from "../../../src/auth/session.js";
import {
  createDeal,
  getDealByIdForCreator,
  getDealsForCreator,
  updateDeal,
  updateDealStage,
} from "../../../src/db/queries/deals.js";
import { getTransactionsForCreator } from "../../../src/db/queries/transactions.js";
import { getPaymentAttemptsForCreator } from "../../../src/db/queries/payment-attempts.js";
import { getCreatorById } from "../../../src/db/queries/creators.js";
import { getOnChainBalanceWithTimeout } from "../../../src/wallet/mpp.js";
import { createApiServer } from "../../../src/api/server.js";
import { deals as dealsRoutes } from "../../../src/api/routes/deals.js";
import { wallet as walletRoutes } from "../../../src/api/routes/wallet.js";
import { createWebhookRoutes } from "../../../src/api/routes/webhooks.js";

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

  it("only reflects CORS for configured dashboard origins", async () => {
    const app = createApiServer({
      allowedOrigins: ["https://dashboard.indyfren.test"],
    });

    const allowed = await app.request("/health", {
      headers: { Origin: "https://dashboard.indyfren.test" },
    });
    const blocked = await app.request("/health", {
      headers: { Origin: "https://evil.example" },
    });

    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://dashboard.indyfren.test",
    );
    expect(blocked.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rejects oversized request bodies before route handling", async () => {
    const app = createApiServer({ maxBodyBytes: 4 });

    const response = await app.request("/missing", {
      method: "POST",
      headers: { "Content-Length": "5" },
      body: "hello",
    });
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toContain("Request body too large");
  });

  it("rate limits noisy callers with a bounded in-memory window", async () => {
    const app = createApiServer({
      rateLimit: { windowMs: 60_000, maxRequests: 1 },
    });

    const first = await app.request("/health");
    const second = await app.request("/health");

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
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
        "Creator service is temporarily unavailable. Please retry in a moment.",
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

  it("rejects invalid deal stage updates", async () => {
    vi.mocked(getDealByIdForCreator).mockResolvedValue({
      id: "deal-1",
      creator_id: "creator-1",
      stage: "discovered",
    } as never);

    const app = createApiServer();
    app.route("/api/deals", dealsRoutes);

    const response = await app.request("/api/deals/deal-1/stage", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ stage: "invented" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid stage");
    expect(updateDealStage).not.toHaveBeenCalled();
  });

  it("creates consumer-authored deal records for the authenticated creator", async () => {
    vi.mocked(createDeal).mockResolvedValue({
      id: "deal-1",
      creator_id: "creator-1",
      brand_name: "Acme",
      stage: "discovered",
      next_action: "Find buyer contact",
      metadata: {},
    } as never);

    const app = createApiServer();
    app.route("/api/deals", dealsRoutes);

    const response = await app.request("/api/deals", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        brandName: "Acme",
        nextAction: "Find buyer contact",
        sourceUrl: "https://acme.example/creators",
        sourceEvidence: [
          { label: "Creator page", url: "https://acme.example/creators" },
        ],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        creator_id: "creator-1",
        brand_name: "Acme",
        next_action: "Find buyer contact",
        source_url: "https://acme.example/creators",
        source_evidence: [
          { label: "Creator page", url: "https://acme.example/creators" },
        ],
      }),
    );
    expect(body.id).toBe("deal-1");
  });

  it("updates consumer deal fields within creator scope", async () => {
    vi.mocked(getDealByIdForCreator).mockResolvedValue({
      id: "deal-1",
      creator_id: "creator-1",
      stage: "discovered",
    } as never);
    vi.mocked(updateDeal).mockResolvedValue({
      id: "deal-1",
      creator_id: "creator-1",
      next_action: "Send follow-up",
      follow_up_at: "2026-06-10T09:00:00.000Z",
    } as never);

    const app = createApiServer();
    app.route("/api/deals", dealsRoutes);

    const response = await app.request("/api/deals/deal-1", {
      method: "PATCH",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nextAction: "Send follow-up",
        followUpAt: "2026-06-10T09:00:00.000Z",
      }),
    });

    expect(response.status).toBe(200);
    expect(updateDeal).toHaveBeenCalledWith("deal-1", {
      next_action: "Send follow-up",
      follow_up_at: "2026-06-10T09:00:00.000Z",
    });
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

  it("returns payment attempts for the authenticated creator with a limit", async () => {
    vi.mocked(getPaymentAttemptsForCreator).mockResolvedValue([]);

    const app = createApiServer();
    app.route("/api/wallet", walletRoutes);

    const response = await app.request(
      "/api/wallet/payment-attempts?limit=10",
      {
        headers: { Authorization: "Bearer access-token" },
      },
    );

    expect(response.status).toBe(200);
    expect(getPaymentAttemptsForCreator).toHaveBeenCalledWith("creator-1", 10);
  });

  it("returns wallet balance with sandbox funding guidance and low-balance state", async () => {
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-1",
      wallet_address: "0xabc",
      settings: {
        spending_limits: {
          per_transaction_cents: 500,
          daily_cents: 5000,
          monthly_cents: 50000,
        },
      },
    } as never);
    vi.mocked(getOnChainBalanceWithTimeout).mockResolvedValue({
      balanceCents: 0,
      balanceFormatted: "$0.00",
    });

    const app = createApiServer();
    app.route("/api/wallet", walletRoutes);

    const response = await app.request("/api/wallet/balance", {
      headers: { Authorization: "Bearer access-token" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      balanceCents: 0,
      walletAddress: "0xabc",
      fundingMode: "tempo_testnet_faucet",
      lowBalance: true,
      minimumRecommendedBalanceCents: 1,
      network: {
        chainId: 42431,
        currency: "pathUSD",
      },
    });
  });

  it("verifies the WhatsApp webhook handshake", async () => {
    const app = createApiServer();
    app.route(
      "/webhooks",
      createWebhookRoutes({
        whatsappEnabled: true,
        whatsappVerifyToken: "indyfren-verify",
      }),
    );

    const response = await app.request(
      "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=indyfren-verify&hub.challenge=12345",
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("12345");
  });

  it("rejects unsigned WhatsApp webhook deliveries", async () => {
    const app = createApiServer();
    app.route("/webhooks", createWebhookRoutes({ whatsappEnabled: true }));

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
