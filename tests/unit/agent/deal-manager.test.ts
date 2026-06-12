import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTool } from "../../../src/agent/tools/registry.js";
import { createDeal } from "../../../src/db/queries/deals.js";
import "../../../src/agent/tools/deal-manager.js";

vi.mock("../../../src/db/queries/deals.js", () => ({
  createDeal: vi.fn(async (input) => ({
    id: "deal-1",
    stage: "discovered",
    brand_name: input.brand_name,
    fit_score: input.fit_score,
    estimated_value_cents: input.estimated_value_cents,
  })),
  updateDealStage: vi.fn(),
  getDealByIdForCreator: vi.fn(),
}));

describe("create_deal tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists sourced discovery metadata when provided", async () => {
    const tool = getTool("create_deal");
    expect(tool).toBeDefined();

    await tool!.execute(
      {
        brand_name: "Sourced Wellness",
        fit_score: 91,
        estimated_value_cents: 350000,
        notes: "Audience overlap with fitness creators.",
        source_url: "https://sourced.example/creators",
        source_evidence: "The brand invites fitness creators to apply.",
        confidence: 0.86,
        dedupe_key: "sourced-wellness|https://sourced.example/creators",
      },
      {
        creatorId: "creator-1",
        mppFetch: vi.fn(),
      },
    );

    expect(createDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          sourceUrl: "https://sourced.example/creators",
          sourceEvidence: "The brand invites fitness creators to apply.",
          confidence: 0.86,
          dedupeKey: "sourced-wellness|https://sourced.example/creators",
        },
      }),
    );
  });

  it("rejects unsourced discovery writes from the brand deal scanner", async () => {
    const tool = getTool("create_deal");

    const result = await tool!.execute(
      {
        brand_name: "Unsourced Brand",
        fit_score: 88,
        estimated_value_cents: 250000,
        notes: "Looks plausible.",
      },
      {
        creatorId: "creator-1",
        activeSkill: "brand-deal-scanner",
        mppFetch: vi.fn(),
      },
    );

    expect(result).toMatchObject({
      success: false,
      data: null,
      error:
        "brand-deal-scanner requires source_url, source_evidence, confidence, and dedupe_key before saving a discovered deal",
    });
    expect(createDeal).not.toHaveBeenCalled();
  });
});
