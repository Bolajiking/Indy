import { describe, it, expect } from "vitest";
import type {
  ContractReview,
  ContractIssue,
} from "../../../src/agent/skills/contract-reviewer.js";

describe("ContractReview shape", () => {
  it("has required fields with proper severity levels", () => {
    const review: ContractReview = {
      summary: "Standard influencer agreement with some concerning clauses.",
      overallRisk: "medium",
      issues: [
        {
          severity: "critical",
          clause: "Creator grants perpetual, worldwide, irrevocable license...",
          issue: "Perpetual usage rights with no additional compensation",
          suggestion:
            "Limit usage rights to 12 months or negotiate buyout pricing",
        },
        {
          severity: "warning",
          clause: "Payment will be made within 90 days of invoice...",
          issue: "Net-90 payment terms are slow",
          suggestion: "Negotiate to net-30 or net-45",
        },
      ],
      missingClauses: ["Kill fee clause", "Content approval window"],
      recommendedChanges: [
        "Add 30-day usage rights expiry",
        "Include kill fee of 50% if campaign is cancelled",
      ],
    };

    expect(review.overallRisk).toMatch(/^(low|medium|high)$/);
    expect(review.issues.length).toBeGreaterThan(0);
    expect(review.issues[0].severity).toBe("critical");
    expect(review.missingClauses.length).toBeGreaterThan(0);
  });

  it("ContractIssue severity is one of the valid values", () => {
    const issue: ContractIssue = {
      severity: "info",
      clause: "FTC disclosure required",
      issue: "Standard FTC compliance clause",
      suggestion: "No changes needed",
    };
    expect(["critical", "warning", "info"]).toContain(issue.severity);
  });
});
