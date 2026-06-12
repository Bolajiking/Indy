import { beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import llm from "../../../src/agent/llm.js";
import { runAgentLoop } from "../../../src/agent/loop.js";
import {
  getToolsForLLM,
  registerTool,
} from "../../../src/agent/tools/registry.js";
import { triageAppToolResult } from "../../../src/integrations/composio.js";

vi.mock("../../../src/agent/llm.js", () => ({
  default: {
    messages: {
      create: vi.fn(),
    },
  },
}));

// Test-only tools (unique names so the global registry isn't disturbed).
registerTool({
  name: "test_deferred_free",
  description: "A deferred free test tool. Second sentence should not appear.",
  autonomyLevel: "autonomous",
  costCategory: "free",
  maxCostPerUseCents: 0,
  deferred: true,
  parameters: {
    target: { type: "string", description: "Required target.", required: true },
  },
  execute: async (params) => ({ success: true, data: `ran:${params.target}` }),
});

registerTool({
  name: "test_deferred_hybrid",
  description: "A deferred hybrid test tool.",
  autonomyLevel: "hybrid",
  costCategory: "mpp",
  maxCostPerUseCents: 50,
  deferred: true,
  parameters: {
    payload: { type: "string", description: "Payload.", required: true },
  },
  execute: async () => ({ success: true, data: "sent" }),
});

function message(
  content: Anthropic.Messages.Message["content"],
  stopReason: Anthropic.Messages.Message["stop_reason"],
): Anthropic.Messages.Message {
  return {
    id: "msg_test",
    container: null,
    content,
    model: "claude-3-5-haiku-latest",
    role: "assistant",
    stop_details: null,
    stop_reason: stopReason,
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

const toolUse = (name: string, input: Record<string, unknown>) =>
  message(
    [
      { type: "tool_use", id: "toolu_1", name, input },
    ] as Anthropic.Messages.Message["content"],
    "tool_use",
  );

const done = (text: string) =>
  message([{ type: "text", text, citations: null }], "end_turn");

describe("deferred tool schemas (registry diet)", () => {
  it("keeps deferred schemas out of the resident tool list", () => {
    const names = getToolsForLLM().map((t) => t.name);
    expect(names).not.toContain("test_deferred_free");
    expect(names).not.toContain("test_deferred_hybrid");
    expect(names).toContain("use_tool");
    // Real production deferrals
    expect(names).not.toContain("generate_media_kit");
    expect(names).not.toContain("enrich_brand");
    expect(names).not.toContain("get_platform_analytics");
    expect(names).not.toContain("disconnect_connections");
  });

  it("catalogs deferred tools as one-liners on use_tool", () => {
    const useTool = getToolsForLLM().find((t) => t.name === "use_tool");
    expect(useTool?.description).toContain(
      "test_deferred_free: A deferred free test tool.",
    );
    expect(useTool?.description).not.toContain("Second sentence");
    const schema = useTool?.input_schema as {
      properties: { tool: { enum: string[] } };
    };
    expect(schema.properties.tool.enum).toContain("test_deferred_hybrid");
  });
});

describe("use_tool unwrapping in the agent loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes the target with unwrapped args and reports the target's name/cost", async () => {
    const used: Array<[string, number]> = [];
    vi.mocked(llm.messages.create)
      .mockResolvedValueOnce(
        toolUse("use_tool", {
          tool: "test_deferred_free",
          arguments: { target: "abc" },
        }),
      )
      .mockResolvedValueOnce(done("finished"));

    const result = await runAgentLoop({
      systemPrompt: "test",
      messages: [{ role: "user", content: "go" }],
      toolContext: null,
      creatorId: "creator-1",
      onToolUsed: (name, cost) => used.push([name, cost]),
    });

    expect(result.toolCallNames).toContain("test_deferred_free");
    expect(used).toEqual([["test_deferred_free", 0]]);
  });

  it("routes hybrid deferred tools through approval with the real name and args", async () => {
    vi.mocked(llm.messages.create).mockResolvedValueOnce(
      toolUse("use_tool", {
        tool: "test_deferred_hybrid",
        arguments: { payload: "hello" },
      }),
    );

    const result = await runAgentLoop({
      systemPrompt: "test",
      messages: [{ role: "user", content: "go" }],
      toolContext: null,
      creatorId: "creator-1",
    });

    expect(result.requiresApproval).toBe(true);
    // approval-execution runs getTool(approval.type).execute(approval.input) —
    // both must be the unwrapped target.
    expect(result.pendingAction?.type).toBe("test_deferred_hybrid");
    expect(result.pendingAction?.input).toEqual({ payload: "hello" });
  });

  it("returns the target's full schema when required params are missing", async () => {
    vi.mocked(llm.messages.create)
      .mockResolvedValueOnce(
        toolUse("use_tool", { tool: "test_deferred_free", arguments: {} }),
      )
      .mockResolvedValueOnce(done("recovered"));

    await runAgentLoop({
      systemPrompt: "test",
      messages: [{ role: "user", content: "go" }],
      toolContext: null,
      creatorId: "creator-1",
    });

    const secondCall = vi.mocked(llm.messages.create).mock.calls[1][0];
    const toolResultMsg = secondCall.messages.at(-1);
    const block = (
      toolResultMsg?.content as Array<{ content: string; is_error?: boolean }>
    )[0];
    expect(block.is_error).toBe(true);
    expect(block.content).toContain("Missing required parameter(s) target");
    expect(block.content).toContain('"test_deferred_free"');
  });

  it("rejects unknown use_tool targets", async () => {
    vi.mocked(llm.messages.create)
      .mockResolvedValueOnce(
        toolUse("use_tool", { tool: "no_such_tool", arguments: {} }),
      )
      .mockResolvedValueOnce(done("ok"));

    await runAgentLoop({
      systemPrompt: "test",
      messages: [{ role: "user", content: "go" }],
      toolContext: null,
      creatorId: "creator-1",
    });

    const secondCall = vi.mocked(llm.messages.create).mock.calls[1][0];
    const block = (
      secondCall.messages.at(-1)?.content as Array<{
        content: string;
        is_error?: boolean;
      }>
    )[0];
    expect(block.is_error).toBe(true);
    expect(block.content).toContain('Unknown tool "no_such_tool"');
  });
});

describe("triageAppToolResult", () => {
  it("headers success and passes clean payloads through", () => {
    const out = triageAppToolResult("GMAIL_FETCH_EMAILS", {
      success: true,
      data: { messages: [{ subject: "Hi" }] },
    });
    expect(out).toContain("ACTION GMAIL_FETCH_EMAILS: completed");
    expect(out).not.toContain("NEEDS REVIEW");
    expect(out).toContain("Hi");
  });

  it("marks failures in the header", () => {
    const out = triageAppToolResult("GMAIL_SEND_EMAIL", {
      success: false,
      data: { message: "quota exceeded" },
    });
    expect(out).toContain("ACTION GMAIL_SEND_EMAIL: FAILED");
  });

  it("surfaces errors buried inside a successful response", () => {
    const out = triageAppToolResult("GMAIL_SEND_EMAIL", {
      success: true,
      data: {
        id: "m-1",
        delivery: { errors: [{ recipient: "bad@", reason: "invalid" }] },
      },
    });
    expect(out).toContain("NEEDS REVIEW");
    expect(out).toContain("delivery.errors");
    expect(out).toContain("bad@");
  });

  it("warns when a write action returns an empty response", () => {
    const out = triageAppToolResult("SLACK_SEND_MESSAGE", {
      success: true,
      data: {},
    });
    expect(out).toContain("empty response for a write action");
  });

  it("does not warn on empty responses for read actions", () => {
    const out = triageAppToolResult("GMAIL_FETCH_EMAILS", {
      success: true,
      data: {},
    });
    expect(out).not.toContain("empty response for a write action");
  });
});
