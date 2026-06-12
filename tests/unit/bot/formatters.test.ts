import { describe, expect, it } from "vitest";
import {
  formatMorningBrief,
  formatRateCard,
  formatScanResults,
} from "../../../src/bot/formatters.js";

describe("bot formatters", () => {
  it("formats a morning brief for chat output", () => {
    const text = formatMorningBrief({
      greeting: "Good morning!",
      items: [
        {
          emoji: "🔥",
          title: "New lead",
          detail: "Acme looks like a good fit.",
          actionPrompt: "Want me to pitch them?",
        },
      ],
      closingNote: "Let's make money today.",
    });

    expect(text).toContain("*New lead*");
    expect(text).toContain("Want me to pitch them?");
  });

  it("formats rate cards and scan results", () => {
    const rates = formatRateCard([
      {
        platform: "instagram",
        contentType: "reel",
        recommendedRateCents: 120000,
        rangeLowCents: 80000,
        rangeHighCents: 160000,
        reasoning: "Strong engagement.",
      },
    ]);
    const scans = formatScanResults({
      opportunities: [
        {
          brandName: "Acme",
          fitScore: 92,
          estimatedValueCents: 250000,
          reason: "Audience fit is strong.",
          source: "search",
        },
      ],
    });

    expect(rates).toContain("Recommended: *$1200*");
    expect(scans).toContain("*Acme*");
    expect(scans).toContain("Fit: 92/100");
  });
});
