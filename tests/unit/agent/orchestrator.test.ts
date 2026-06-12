import { describe, it, expect } from "vitest";
import {
  getAllTools,
  registerTool,
  getToolsForLLM,
  type AgentTool,
} from "../../../src/agent/tools/registry.js";

describe("tool registry", () => {
  it("registers and retrieves tools", () => {
    const tool: AgentTool = {
      name: "test_tool",
      description: "A test tool",
      autonomyLevel: "autonomous",
      costCategory: "free",
      maxCostPerUseCents: 0,
      parameters: {
        query: { type: "string", description: "Search query", required: true },
      },
      execute: async () => ({ success: true, data: "result" }),
    };
    registerTool(tool);
    const retrieved = getAllTools();
    expect(retrieved.some((t) => t.name === "test_tool")).toBe(true);
  });

  it("formats tools for LLM consumption", () => {
    const formatted = getToolsForLLM();
    const testTool = formatted.find((t) => t.name === "test_tool");
    expect(testTool).toBeDefined();
    expect(testTool!.input_schema.type).toBe("object");
    expect(testTool!.input_schema.required).toContain("query");
  });
});
