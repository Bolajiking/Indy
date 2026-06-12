import { beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import llm from "../../../src/agent/llm.js";
import { runAgentLoop } from "../../../src/agent/loop.js";
import { searchCatalog } from "../../../src/integrations/composio.js";
import {
  formatActiveDeals,
  formatRecentSpending,
} from "../../../src/agent/memory.js";

vi.mock("../../../src/agent/llm.js", () => ({
  default: {
    messages: {
      create: vi.fn(),
    },
  },
}));

function toolUseMessage(
  name: string,
  input: Record<string, unknown>,
): Anthropic.Messages.Message {
  return {
    id: "msg_tool",
    container: null,
    content: [
      { type: "tool_use", id: "toolu_1", name, input },
    ] as Anthropic.Messages.Message["content"],
    model: "claude-3-5-haiku-latest",
    role: "assistant",
    stop_details: null,
    stop_reason: "tool_use",
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

describe("execute_app_tool approval unwrapping in the agent loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the real action slug and arguments on the pending approval", async () => {
    vi.mocked(llm.messages.create).mockResolvedValueOnce(
      toolUseMessage("execute_app_tool", {
        slug: "GMAIL_SEND_EMAIL",
        arguments: { to: "brand@example.com", subject: "Pitch" },
      }),
    );

    const result = await runAgentLoop({
      systemPrompt: "test",
      messages: [{ role: "user", content: "send the pitch" }],
      toolContext: null,
      dynamicTools: [],
      executeDynamicTool: async () => ({ content: "ok", isError: false }),
      dynamicToolNeedsApproval: (name, input) =>
        name === "execute_app_tool" &&
        String(input.slug).includes("SEND"),
    });

    expect(result.requiresApproval).toBe(true);
    // Approval execution runs `executeComposioToolBySlug(creatorId, approval.type,
    // approval.input)` — so type must be the unwrapped slug, input the unwrapped args.
    expect(result.pendingAction?.type).toBe("GMAIL_SEND_EMAIL");
    expect(result.pendingAction?.input).toEqual({
      to: "brand@example.com",
      subject: "Pitch",
    });
    expect(result.text).toContain("GMAIL_SEND_EMAIL");
  });

  it("executes read actions without approval", async () => {
    const executed: string[] = [];
    vi.mocked(llm.messages.create)
      .mockResolvedValueOnce(
        toolUseMessage("execute_app_tool", {
          slug: "GMAIL_FETCH_EMAILS",
          arguments: { max_results: 5 },
        }),
      )
      .mockResolvedValueOnce({
        ...toolUseMessage("noop", {}),
        content: [{ type: "text", text: "Here are your emails", citations: null }],
        stop_reason: "end_turn",
      } as Anthropic.Messages.Message);

    const result = await runAgentLoop({
      systemPrompt: "test",
      messages: [{ role: "user", content: "check email" }],
      toolContext: null,
      dynamicTools: [],
      executeDynamicTool: async (name, input) => {
        executed.push(`${name}:${String(input.slug)}`);
        return { content: "[]", isError: false };
      },
      dynamicToolNeedsApproval: (name, input) =>
        name === "execute_app_tool" && String(input.slug).includes("SEND"),
    });

    expect(result.requiresApproval).toBe(false);
    expect(executed).toEqual(["execute_app_tool:GMAIL_FETCH_EMAILS"]);
  });
});

describe("searchCatalog", () => {
  const catalog = [
    { slug: "GMAIL_SEND_EMAIL", description: "Send an email message" },
    { slug: "GMAIL_GET_VACATION_SETTINGS", description: "Read vacation auto-reply settings" },
    { slug: "GMAIL_CREATE_LABEL", description: "Create a new label" },
    { slug: "GMAIL_LIST_LABELS", description: "List all labels in the mailbox" },
  ];

  it("matches against slug and description, slug-first", () => {
    const hits = searchCatalog(catalog, "label").map((t) => t.slug);
    expect(hits).toContain("GMAIL_CREATE_LABEL");
    expect(hits).toContain("GMAIL_LIST_LABELS");
    expect(hits).not.toContain("GMAIL_SEND_EMAIL");
  });

  it("finds long-tail actions by description keywords", () => {
    const hits = searchCatalog(catalog, "vacation responder").map(
      (t) => t.slug,
    );
    expect(hits[0]).toBe("GMAIL_GET_VACATION_SETTINGS");
  });

  it("returns empty for no matches or empty query", () => {
    expect(searchCatalog(catalog, "spreadsheet pivot")).toEqual([]);
    expect(searchCatalog(catalog, "")).toEqual([]);
  });

  it("respects the result limit", () => {
    expect(searchCatalog(catalog, "gmail", 2)).toHaveLength(2);
  });
});

describe("context compression", () => {
  it("groups repeated spending into one line with count and total", () => {
    const out = formatRecentSpending([
      { description: "Web search", amount_cents: 5 },
      { description: "Web search", amount_cents: 5 },
      { description: "Web search", amount_cents: 5 },
      { description: "Brand enrichment", amount_cents: 25 },
    ]);
    expect(out).toContain("Web search ×3: $0.15 total");
    expect(out).toContain("Brand enrichment: $0.25");
  });

  it("orders deals by stage priority then value, notes only on top deals", () => {
    const deal = (
      id: string,
      stage: string,
      cents: number,
      notes: string | null = null,
    ) => ({
      id,
      brand_name: id,
      stage,
      estimated_value_cents: cents,
      notes,
    });
    const out = formatActiveDeals([
      deal("d-discovered", "discovered", 900000, "late-stage note"),
      deal("d-negotiating", "negotiating", 100000, "hot deal"),
    ]);
    const lines = out.split("\n");
    expect(lines[0]).toContain("d-negotiating");
    expect(lines[0]).toContain("hot deal");
    expect(lines[1]).toContain("d-discovered");
  });

  it("caps the deal list and reports the remainder", () => {
    const deals = Array.from({ length: 25 }, (_, i) => ({
      id: `deal-${i}`,
      brand_name: `Brand ${i}`,
      stage: "discovered",
      estimated_value_cents: 1000,
      notes: null,
    }));
    const out = formatActiveDeals(deals);
    expect(out).toContain("deal-0");
    expect(out).toContain("and 5 more");
    expect(out).not.toContain("deal-24");
  });
});
