import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/queries/deals.js", () => ({
  getDealsForCreator: vi.fn().mockResolvedValue([
    {
      id: "deal-1",
      brand_name: "Acme",
      stage: "discovered",
      fit_score: 85,
      estimated_value_cents: 100000,
      actual_value_cents: null,
      updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      created_at: new Date().toISOString(),
    },
    {
      id: "deal-2",
      brand_name: "Beta Corp",
      stage: "active",
      fit_score: 70,
      estimated_value_cents: 50000,
      actual_value_cents: null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: "deal-3",
      brand_name: "Done Inc",
      stage: "completed",
      fit_score: 90,
      estimated_value_cents: 80000,
      actual_value_cents: 80000,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ]),
}));

import { getCalendarView } from "../../../src/agent/skills/calendar-manager.js";

describe("calendar-manager", () => {
  it("generates calendar events from deal pipeline", async () => {
    const calendar = await getCalendarView("creator-1");

    expect(calendar.creatorId).toBe("creator-1");
    expect(calendar.generatedAt).toBeDefined();
    // deal-1 (discovered, 5 days ago) should be overdue (>3 days)
    expect(calendar.overdue.length).toBeGreaterThan(0);
    expect(calendar.overdue.some((e) => e.brandName === "Acme")).toBe(true);
    // deal-2 (active) should have upcoming content delivery and invoice events
    expect(calendar.upcoming.some((e) => e.brandName === "Beta Corp")).toBe(
      true,
    );
    // deal-3 (completed) should be excluded
    expect(calendar.upcoming.every((e) => e.brandName !== "Done Inc")).toBe(
      true,
    );
    expect(calendar.overdue.every((e) => e.brandName !== "Done Inc")).toBe(
      true,
    );
  });
});
