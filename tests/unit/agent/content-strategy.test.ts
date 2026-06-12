import { describe, expect, it } from "vitest";
import type {
  ContentStrategyReport,
  ContentIdea,
} from "../../../src/agent/skills/content-strategy.js";

describe("content-strategy types", () => {
  it("ContentStrategyReport has the expected shape", () => {
    const report: ContentStrategyReport = {
      summary: "Focus on short-form this week",
      weeklyTheme: "Behind the scenes",
      ideas: [
        {
          title: "Day in my life vlog",
          platform: "youtube",
          format: "video",
          description: "Show the creative process",
          tieIn: "Acme sponsorship",
          priority: 1,
        },
      ],
      bestPostingTimes: { youtube: "Tuesday 2pm", instagram: "Daily 9am" },
      trendOpportunities: ["AI content tools trending"],
    };

    expect(report.ideas).toHaveLength(1);
    expect(report.weeklyTheme).toBe("Behind the scenes");
    expect(report.bestPostingTimes).toHaveProperty("youtube");
  });

  it("ContentIdea has required fields", () => {
    const idea: ContentIdea = {
      title: "Test",
      platform: "tiktok",
      format: "short",
      description: "Test description",
      priority: 2,
    };

    expect(idea.tieIn).toBeUndefined();
    expect(idea.priority).toBe(2);
  });
});
