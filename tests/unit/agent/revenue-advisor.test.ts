import { describe, expect, it } from "vitest";
import type { RevenueAdvisorReport, RevenueStream, DiversificationSuggestion } from "../../../src/agent/skills/revenue-advisor.js";

describe("revenue-advisor types", () => {
  it("RevenueAdvisorReport has the expected shape", () => {
    const report: RevenueAdvisorReport = {
      summary: "Test summary",
      currentStreams: [
        {
          source: "Brand deals",
          estimatedMonthlyCents: 500000,
          trend: "growing",
          notes: "Strong pipeline",
        },
      ],
      totalEstimatedMonthlyCents: 500000,
      suggestions: [
        {
          title: "Launch merch",
          description: "Sell branded merchandise",
          estimatedMonthlyCents: 100000,
          effort: "medium",
          priority: 1,
        },
      ],
      riskAssessment: "Moderate concentration risk",
    };

    expect(report.currentStreams).toHaveLength(1);
    expect(report.suggestions[0].effort).toBe("medium");
    expect(report.totalEstimatedMonthlyCents).toBe(500000);
  });

  it("RevenueStream trend is constrained", () => {
    const stream: RevenueStream = {
      source: "YouTube AdSense",
      estimatedMonthlyCents: 200000,
      trend: "declining",
      notes: "Algorithm changes",
    };

    expect(["growing", "stable", "declining"]).toContain(stream.trend);
  });

  it("DiversificationSuggestion effort is constrained", () => {
    const suggestion: DiversificationSuggestion = {
      title: "Online course",
      description: "Create a paid course",
      estimatedMonthlyCents: 300000,
      effort: "high",
      priority: 2,
    };

    expect(["low", "medium", "high"]).toContain(suggestion.effort);
  });
});
