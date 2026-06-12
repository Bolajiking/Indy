import { beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import llm from "../../../src/agent/llm.js";
import { createDeal } from "../../../src/db/queries/deals.js";
import {
  scanForBrandDeals,
  type ScanResult,
} from "../../../src/agent/skills/brand-deal-scanner.js";

vi.mock("../../../src/agent/llm.js", () => ({
  default: {
    messages: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../../../src/agent/memory.js", () => ({
  assembleContext: vi.fn(
    async () => "Creator has 50k fitness followers on TikTok",
  ),
}));

vi.mock("../../../src/db/queries/deals.js", () => ({
  createDeal: vi.fn(async (input) => ({ id: "deal-1", ...input })),
}));

function anthropicTextMessage(text: string): Anthropic.Messages.Message {
  return {
    id: "msg_test",
    container: null,
    content: [{ type: "text", text, citations: null }],
    model: "claude-3-5-haiku-latest",
    role: "assistant",
    stop_details: null,
    stop_reason: "end_turn",
    stop_sequence: null,
    type: "message",
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      inference_geo: null,
      input_tokens: 1,
      output_tokens: 1,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: "standard",
    },
  };
}

describe("ScanResult shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has opportunities array", () => {
    const result: ScanResult = {
      status: "ok",
      opportunities: [
        {
          brandName: "TestBrand",
          fitScore: 85,
          estimatedValueCents: 250000,
          reason: "Good fit",
          source: "manual",
          sourceUrl: "https://example.com/partners",
          sourceEvidence: "Example has a public creator partners page.",
          confidence: 0.8,
          dedupeKey: "testbrand|example.com/partners",
        },
      ],
    };

    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].fitScore).toBeGreaterThanOrEqual(0);
    expect(result.opportunities[0].fitScore).toBeLessThanOrEqual(100);
  });

  it("persists only opportunities with sourced evidence metadata", async () => {
    vi.mocked(llm.messages.create).mockResolvedValueOnce(
      anthropicTextMessage(
        JSON.stringify({
          opportunities: [
            {
              brandName: "Sourced Wellness",
              fitScore: 91,
              estimatedValueCents: 350000,
              reason: "Audience overlap with fitness creators.",
              source: "creator partnerships page",
              sourceUrl: "https://sourced.example/creators",
              sourceEvidence:
                "The brand invites fitness creators to apply for partnerships.",
              confidence: 0.86,
            },
            {
              brandName: "Vibes Only",
              fitScore: 88,
              estimatedValueCents: 250000,
              reason: "Seems plausible for fitness.",
              source: "model guess",
            },
          ],
        }),
      ),
    );

    const result = await scanForBrandDeals("creator-1", "fitness", ["TikTok"]);

    expect(result.status).toBe("ok");
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]).toMatchObject({
      brandName: "Sourced Wellness",
      sourceUrl: "https://sourced.example/creators",
      sourceEvidence:
        "The brand invites fitness creators to apply for partnerships.",
      confidence: 0.86,
      dedupeKey: "sourced-wellness|https://sourced.example/creators",
    });
    expect(createDeal).toHaveBeenCalledTimes(1);
    expect(createDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_name: "Sourced Wellness",
        metadata: {
          source: "creator partnerships page",
          sourceUrl: "https://sourced.example/creators",
          sourceEvidence:
            "The brand invites fitness creators to apply for partnerships.",
          confidence: 0.86,
          dedupeKey: "sourced-wellness|https://sourced.example/creators",
        },
      }),
    );
  });

  it("returns a validation failure and saves nothing when no opportunities have evidence", async () => {
    vi.mocked(llm.messages.create).mockResolvedValueOnce(
      anthropicTextMessage(
        JSON.stringify({
          opportunities: [
            {
              brandName: "Fabricated Fit",
              fitScore: 94,
              estimatedValueCents: 500000,
              reason: "The model thinks this could work.",
              source: "generated",
            },
          ],
        }),
      ),
    );

    const result = await scanForBrandDeals("creator-1", "fitness", ["TikTok"]);

    expect(result).toMatchObject({
      status: "no_sourced_opportunities",
      opportunities: [],
    });
    expect(result.errors?.[0]).toContain("sourceUrl");
    expect(createDeal).not.toHaveBeenCalled();
  });
});
