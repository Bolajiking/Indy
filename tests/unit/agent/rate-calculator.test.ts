import { describe, it, expect } from "vitest";
import type { RateCard } from "../../../src/agent/skills/rate-calculator.js";

describe("RateCard shape", () => {
  it("has required fields", () => {
    const card: RateCard = {
      platform: "instagram",
      contentType: "reel",
      recommendedRateCents: 120000,
      rangeLowCents: 80000,
      rangeHighCents: 160000,
      reasoning: "Based on 50K followers at 4.2% engagement in finance niche",
    };

    expect(card.recommendedRateCents).toBeGreaterThan(card.rangeLowCents);
    expect(card.recommendedRateCents).toBeLessThan(card.rangeHighCents);
  });
});
