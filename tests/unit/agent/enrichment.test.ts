import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTool } from "../../../src/agent/tools/registry.js";
import type { ToolContext } from "../../../src/agent/tools/registry.js";
import "../../../src/agent/tools/enrichment.js";

describe("enrich_brand tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails explicitly when no discoverable brand enrichment service is available", async () => {
    const tool = getTool("enrich_brand");
    expect(tool).toBeDefined();

    const result = await tool!.execute(
      { company_name: "Acme" },
      {
        creatorId: "creator-1",
        mppFetch: vi.fn(),
        findService: vi.fn(async () => null),
      },
    );

    expect(result).toMatchObject({
      success: false,
      data: null,
      error: "No paid service available for capability brand_enrichment",
    });
  });

  it("discovers the payable endpoint before calling mppFetch", async () => {
    const tool = getTool("enrich_brand");
    const mppFetch: ToolContext["mppFetch"] = vi.fn(
      async () =>
        new Response(JSON.stringify({ company: "Acme", domain: "acme.test" })),
    );

    const result = await tool!.execute(
      { company_name: "Acme" },
      {
        creatorId: "creator-1",
        mppFetch,
        findService: vi.fn(async () => ({
          capability: "brand_enrichment",
          name: "Test Enrich",
          url: "https://paid.example/enrich",
          estimatedCostCents: 42,
          description: "Test enrichment service",
          source: "bazaar",
        })),
      },
    );

    expect(result).toMatchObject({
      success: true,
      data: { company: "Acme", domain: "acme.test" },
      costCents: 42,
    });
    expect(mppFetch).toHaveBeenCalledWith(
      "https://paid.example/enrich",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
