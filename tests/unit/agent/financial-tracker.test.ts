import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/queries/deals.js", () => ({
  getDealsForCreator: vi.fn().mockResolvedValue([
    {
      brand_name: "Acme",
      stage: "completed",
      estimated_value_cents: 100000,
      actual_value_cents: 120000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      brand_name: "Beta Corp",
      stage: "active",
      estimated_value_cents: 50000,
      actual_value_cents: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]),
}));

vi.mock("../../../src/db/queries/transactions.js", () => ({
  getTransactionsForCreator: vi.fn().mockResolvedValue([
    {
      type: "mpp_payment",
      amount_cents: -50,
      description: "StableEnrich API",
      created_at: new Date().toISOString(),
    },
  ]),
}));

import { generateFinancialSnapshot } from "../../../src/agent/skills/financial-tracker.js";

describe("financial-tracker", () => {
  it("generates a financial snapshot from deals and transactions", async () => {
    const snapshot = await generateFinancialSnapshot("creator-1");

    expect(snapshot.creatorId).toBe("creator-1");
    expect(snapshot.income.totalCents).toBe(120000);
    expect(snapshot.income.bySource).toHaveProperty("Acme");
    expect(snapshot.expenses.totalCents).toBe(50);
    expect(snapshot.expenses.agentSpendCents).toBe(50);
    expect(snapshot.netCents).toBe(120000 - 50);
    expect(snapshot.pipeline.activeDealCount).toBe(1);
    expect(snapshot.pipeline.totalPipelineValueCents).toBe(50000);
    expect(snapshot.forecast.nextMonthEstimateCents).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(snapshot.forecast.confidence);
  });
});
