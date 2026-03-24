import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/session.js", () => ({
  authenticateAccessToken: vi.fn(),
}));

vi.mock("../../../src/agent/skills/financial-tracker.js", () => ({
  generateFinancialSnapshot: vi.fn().mockResolvedValue({
    creatorId: "creator-1",
    period: "2026-03",
    income: { totalCents: 100000, bySource: { Acme: 100000 } },
    expenses: { totalCents: 500, agentSpendCents: 500, byCategory: {} },
    netCents: 99500,
    pipeline: { activeDealCount: 2, totalPipelineValueCents: 50000 },
    forecast: { nextMonthEstimateCents: 120000, confidence: "medium" },
  }),
}));

vi.mock("../../../src/agent/skills/analytics-aggregator.js", () => ({
  aggregateAnalytics: vi.fn().mockResolvedValue({
    creatorId: "creator-1",
    collectedAt: new Date().toISOString(),
    platforms: [],
    totalFollowers: 0,
    avgEngagementRate: 0,
  }),
}));

import { Hono } from "hono";
import { authenticateAccessToken } from "../../../src/auth/session.js";
import { reports } from "../../../src/api/routes/reports.js";

describe("reports API", () => {
  const app = new Hono();
  app.route("/reports", reports);

  beforeEach(() => {
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      creatorId: "creator-1",
      privyUserId: "did:privy:creator-1",
    });
  });

  it("GET /reports/financial requires auth and returns a financial snapshot", async () => {
    const res = await app.request("/reports/financial", {
      headers: { Authorization: "Bearer access-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creatorId).toBe("creator-1");
    expect(body.income.totalCents).toBe(100000);
    expect(body.netCents).toBe(99500);
  });

  it("GET /reports/analytics returns aggregated analytics", async () => {
    const res = await app.request("/reports/analytics", {
      headers: { Authorization: "Bearer access-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.creatorId).toBe("creator-1");
    expect(body.platforms).toEqual([]);
  });

  it("rejects unauthenticated report access", async () => {
    const res = await app.request("/reports/revenue");
    expect(res.status).toBe(401);
  });

  it("POST /reports/seo returns 400 without platform", async () => {
    const res = await app.request("/reports/seo", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: "Test" }),
    });
    expect(res.status).toBe(400);
  });
});
