import { describe, expect, it } from "vitest";
import { getTool } from "../../../src/agent/tools/registry.js";

// Import to trigger registration
import "../../../src/agent/tools/browser.js";

describe("browser tool", () => {
  it("is registered in the tool registry", () => {
    const tool = getTool("browse_web");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("browse_web");
  });

  it("has autonomous autonomy level", () => {
    const tool = getTool("browse_web")!;
    expect(tool.autonomyLevel).toBe("autonomous");
  });

  it("uses platform-api cost category", () => {
    const tool = getTool("browse_web")!;
    expect(tool.costCategory).toBe("platform-api");
  });

  it("requires url parameter", () => {
    const tool = getTool("browse_web")!;
    expect(tool.parameters.url.required).toBe(true);
  });

  it("returns error when BrowserBase is not configured", async () => {
    const tool = getTool("browse_web")!;
    const result = await tool.execute(
      { url: "https://example.com" },
      { creatorId: "test", mppFetch: fetch }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("BrowserBase is not configured");
  });
});
