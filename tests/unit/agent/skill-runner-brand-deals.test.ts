import { beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import llm from "../../../src/agent/llm.js";
import { runAgentLoop } from "../../../src/agent/loop.js";
import { runSkill } from "../../../src/agent/os/skill-runner.js";
import { createDeal } from "../../../src/db/queries/deals.js";

vi.mock("../../../src/agent/loop.js", () => ({
  runAgentLoop: vi.fn(),
}));

vi.mock("../../../src/agent/os/creator-memory.js", () => ({
  loadMemoryForSkill: vi.fn(async () => ""),
  extractAndSaveLearnings: vi.fn(),
}));

vi.mock("../../../src/agent/memory.js", () => ({
  assembleContext: vi.fn(async () => "Creator context"),
  getRecentMessages: vi.fn(async () => []),
  buildConversationMessages: vi.fn(
    (context: string, _recent: unknown, userMessage: string) => [
      {
        role: "user",
        content: `<creator_context>\n${context}\n</creator_context>\n\n${userMessage}`,
      },
    ],
  ),
}));

vi.mock("../../../src/db/queries/deals.js", () => ({
  createDeal: vi.fn(async (input) => ({ id: "deal-1", ...input })),
}));

vi.mock("../../../src/wallet/mpp.js", () => ({
  createMppClient: vi.fn(),
}));

vi.mock("../../../src/wallet/privy.js", () => ({
  resolveWalletForCreator: vi.fn(),
}));

vi.mock("../../../src/agent/llm.js", () => ({
  default: {
    messages: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../../../src/integrations/composio.js", () => ({
  composioLoopTools: vi.fn(async () => ({})),
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

describe("brand-deal-scanner AgentOS validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not save fallback-extracted deals without source evidence", async () => {
    vi.mocked(runAgentLoop).mockResolvedValueOnce({
      text: "Try Nike. Fit score 90. Estimated value $2,000. This is a strong audience fit worth pitching first.",
      requiresApproval: false,
      toolCallNames: [],
    });
    vi.mocked(llm.messages.create).mockResolvedValueOnce(
      anthropicTextMessage(
        JSON.stringify({
          deals: [
            {
              brand_name: "Nike",
              fit_score: 90,
              estimated_value_cents: 200000,
              notes: "Good audience fit.",
            },
          ],
        }),
      ),
    );

    const result = await runSkill({
      creatorId: "creator-1",
      skill: "brand-deal-scanner",
      userMessage: "Find me deals",
      extractedParams: {},
    });

    expect(createDeal).not.toHaveBeenCalled();
    expect(result.text).toContain("No deal was saved");
  });
});
