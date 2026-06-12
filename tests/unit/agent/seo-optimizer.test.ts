import { describe, expect, it } from "vitest";
import type {
  SeoAnalysis,
  SeoSuggestion,
} from "../../../src/agent/skills/seo-optimizer.js";

describe("seo-optimizer types", () => {
  it("SeoAnalysis has the expected shape", () => {
    const analysis: SeoAnalysis = {
      overallScore: 72,
      suggestions: [
        {
          field: "title",
          current: "My Video",
          suggested: "How I Made $10K in One Month | Creator Tips 2026",
          reason: "Includes numbers, keywords, and curiosity gap",
          impact: "high",
        },
      ],
      keywordOpportunities: ["creator economy", "brand deals"],
      competitorInsights: "Top creators use numbers in titles",
    };

    expect(analysis.overallScore).toBe(72);
    expect(analysis.suggestions).toHaveLength(1);
    expect(analysis.suggestions[0].impact).toBe("high");
    expect(analysis.keywordOpportunities).toContain("creator economy");
  });

  it("SeoSuggestion field is constrained", () => {
    const fields: SeoSuggestion["field"][] = [
      "title",
      "description",
      "tags",
      "thumbnail",
      "hook",
      "hashtags",
    ];
    expect(fields).toHaveLength(6);
  });
});
