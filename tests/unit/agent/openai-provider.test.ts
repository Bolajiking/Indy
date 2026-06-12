import { beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock("../../../src/network/ipv4-fetch.js", () => ({
  ipv4Fetch: fetchMock,
}));

import { createOpenAIMessage } from "../../../src/agent/providers/openai.js";

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const OPTS = {
  baseURL: "https://api.example.com/v1",
  apiKey: "k",
  model: "gpt-4o",
};

describe("OpenAI-compatible provider", () => {
  beforeEach(() => fetchMock.mockReset());

  it("translates Anthropic params to a Chat Completions request", async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({
        id: "x",
        choices: [{ finish_reason: "stop", message: { content: "hello" } }],
        usage: { prompt_tokens: 3, completion_tokens: 2 },
      }),
    );

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: "You are helpful",
      messages: [{ role: "user", content: "hi" }],
      tools: [
        {
          name: "save_deal",
          description: "save a deal",
          input_schema: { type: "object", properties: {} },
        },
      ],
    };

    const result = await createOpenAIMessage(params, OPTS);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    const body = JSON.parse((init as { body: string }).body);
    expect(body.model).toBe("gpt-4o");
    expect(body.messages[0]).toEqual({
      role: "system",
      content: "You are helpful",
    });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
    expect(body.tools[0].function.name).toBe("save_deal");
    expect(body.tool_choice).toBe("auto");

    expect(result.stop_reason).toBe("end_turn");
    expect(result.content).toEqual([
      { type: "text", text: "hello", citations: null },
    ]);
    expect(result.usage.input_tokens).toBe(3);
  });

  it("maps tool calls back to Anthropic tool_use blocks", async () => {
    fetchMock.mockResolvedValueOnce(
      okResponse({
        choices: [
          {
            finish_reason: "tool_calls",
            message: {
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "save_deal",
                    arguments: '{"brand_name":"Acme"}',
                  },
                },
              ],
            },
          },
        ],
      }),
    );

    const result = await createOpenAIMessage(
      {
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        messages: [{ role: "user", content: "find deals" }],
      },
      OPTS,
    );

    expect(result.stop_reason).toBe("tool_use");
    const block = result.content[0];
    expect(block.type).toBe("tool_use");
    if (block.type === "tool_use") {
      expect(block.name).toBe("save_deal");
      expect(block.input).toEqual({ brand_name: "Acme" });
    }
  });

  it("surfaces HTTP status on failure for retry handling", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
      text: async () => "rate limited",
    });

    await expect(
      createOpenAIMessage(
        {
          model: "claude-sonnet-4-6",
          max_tokens: 16,
          messages: [{ role: "user", content: "hi" }],
        },
        OPTS,
      ),
    ).rejects.toMatchObject({ status: 429 });
  });
});
