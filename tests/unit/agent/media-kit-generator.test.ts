import { describe, expect, it } from "vitest";
import { getTool, getAllTools } from "../../../src/agent/tools/registry.js";

// Import to trigger registration
import "../../../src/agent/tools/media-kit-generator.js";

describe("media-kit-generator tool", () => {
  it("is registered in the tool registry", () => {
    const tool = getTool("generate_media_kit");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("generate_media_kit");
  });

  it("has autonomous autonomy level", () => {
    const tool = getTool("generate_media_kit")!;
    expect(tool.autonomyLevel).toBe("autonomous");
  });

  it("uses mpp cost category", () => {
    const tool = getTool("generate_media_kit")!;
    expect(tool.costCategory).toBe("mpp");
  });

  it("requires creator_name, niche, follower_count, and platforms", () => {
    const tool = getTool("generate_media_kit")!;
    const required = Object.entries(tool.parameters)
      .filter(([, v]) => v.required)
      .map(([k]) => k);

    expect(required).toContain("creator_name");
    expect(required).toContain("niche");
    expect(required).toContain("follower_count");
    expect(required).toContain("platforms");
  });
});
