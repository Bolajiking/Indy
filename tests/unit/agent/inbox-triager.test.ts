import { describe, expect, it } from "vitest";
import type {
  TriageResult,
  TriagedMessage,
} from "../../../src/agent/skills/inbox-triager.js";

describe("inbox-triager types", () => {
  it("TriageResult has the expected shape", () => {
    const result: TriageResult = {
      messages: [
        {
          originalText: "Hey, we'd love to sponsor your next video",
          category: "brand_deal",
          priority: "high",
          suggestedAction: "Reply with rate card",
          brandMentioned: "Nike",
          requiresResponse: true,
        },
        {
          originalText: "Love your content!",
          category: "fan_mail",
          priority: "low",
          suggestedAction: "Optional: quick thank you",
          requiresResponse: false,
        },
      ],
      summary: "2 messages: 1 brand deal inquiry, 1 fan mail",
      actionRequired: 1,
    };

    expect(result.messages).toHaveLength(2);
    expect(result.actionRequired).toBe(1);
    expect(result.messages[0].category).toBe("brand_deal");
    expect(result.messages[1].requiresResponse).toBe(false);
  });

  it("TriagedMessage category is constrained", () => {
    const categories: TriagedMessage["category"][] = [
      "brand_deal",
      "collaboration",
      "fan_mail",
      "spam",
      "urgent",
      "general",
    ];
    expect(categories).toHaveLength(6);
  });
});
