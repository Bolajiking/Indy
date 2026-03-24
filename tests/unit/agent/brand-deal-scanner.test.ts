import { describe, it, expect } from "vitest";
import type { ScanResult } from "../../../src/agent/skills/brand-deal-scanner.js";

describe("ScanResult shape", () => {
  it("has opportunities array", () => {
    const result: ScanResult = {
      opportunities: [
        {
          brandName: "TestBrand",
          fitScore: 85,
          estimatedValueCents: 250000,
          reason: "Good fit",
          source: "manual",
        },
      ],
    };

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].fitScore).toBeGreaterThanOrEqual(0);
    expect(result.opportunities[0].fitScore).toBeLessThanOrEqual(100);
  });
});
