import { describe, it, expect } from "vitest";
import { formatContractReview } from "../../../src/bot/formatters.js";

describe("formatContractReview", () => {
  it("formats a contract review with risk level and issues", () => {
    const text = formatContractReview({
      summary: "Standard agreement with concerning exclusivity.",
      overallRisk: "high",
      issues: [
        {
          severity: "critical",
          clause: "Creator may not work with competing brands for 24 months",
          issue: "Overly broad non-compete",
          suggestion: "Limit to 3 months and define competing brands narrowly",
        },
      ],
      missingClauses: ["Kill fee clause"],
      recommendedChanges: ["Add content approval window of 48 hours"],
    });

    expect(text).toContain("Risk: *HIGH*");
    expect(text).toContain("🔴");
    expect(text).toContain("Overly broad non-compete");
    expect(text).toContain("Kill fee clause");
    expect(text).toContain("content approval window");
  });

  it("handles low risk with no issues", () => {
    const text = formatContractReview({
      summary: "Clean contract, well-balanced terms.",
      overallRisk: "low",
      issues: [],
      missingClauses: [],
      recommendedChanges: [],
    });

    expect(text).toContain("🟢");
    expect(text).toContain("Risk: *LOW*");
    expect(text).not.toContain("Issues Found");
  });
});
