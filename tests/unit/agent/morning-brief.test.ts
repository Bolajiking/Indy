import { describe, it, expect } from "vitest";
import type { MorningBrief } from "../../../src/agent/skills/morning-brief.js";

describe("MorningBrief shape", () => {
  it("has greeting, items, and closing note", () => {
    const brief: MorningBrief = {
      greeting: "Good morning!",
      items: [
        {
          emoji: "🔥",
          title: "New deal",
          detail: "Brand X wants to work with you",
          actionPrompt: "Want me to pitch?",
        },
      ],
      closingNote: "You're doing great!",
    };

    expect(brief.items.length).toBeLessThanOrEqual(3);
    expect(brief.items[0].actionPrompt).toBeTruthy();
  });
});
