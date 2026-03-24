import { describe, it, expect } from "vitest";
import { getAllTools } from "../../../src/agent/tools/registry.js";

// Import the tool to register it
import "../../../src/agent/tools/platform-analytics.js";

describe("get_platform_analytics tool", () => {
  it("is registered in the tool registry", () => {
    const tools = getAllTools();
    const analyticsTool = tools.find((t) => t.name === "get_platform_analytics");
    expect(analyticsTool).toBeDefined();
  });

  it("is autonomous and uses MPP", () => {
    const tools = getAllTools();
    const analyticsTool = tools.find((t) => t.name === "get_platform_analytics")!;
    expect(analyticsTool.autonomyLevel).toBe("autonomous");
    expect(analyticsTool.costCategory).toBe("mpp");
  });

  it("requires platform and username parameters", () => {
    const tools = getAllTools();
    const analyticsTool = tools.find((t) => t.name === "get_platform_analytics")!;
    expect(analyticsTool.parameters.platform.required).toBe(true);
    expect(analyticsTool.parameters.username.required).toBe(true);
  });

  it("returns error for unsupported platforms", async () => {
    const tools = getAllTools();
    const analyticsTool = tools.find((t) => t.name === "get_platform_analytics")!;
    const result = await analyticsTool.execute(
      { platform: "myspace", username: "test" },
      { creatorId: "test", mppFetch: async () => new Response() }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unsupported platform");
  });
});
