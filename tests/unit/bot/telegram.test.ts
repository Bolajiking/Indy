import { describe, expect, it, vi } from "vitest";
vi.mock("../../../src/db/queries/agent-actions.js", () => ({
  createPendingAgentAction: vi.fn().mockImplementation(async (input) => ({
    id: input.id,
    creator_id: input.creator_id,
    action_type: input.action_type,
    status: "pending",
    description: input.description,
    input: input.input,
    output: null,
    cost_cents: 0,
    requires_approval: true,
    approved_at: null,
    executed_at: null,
    created_at: new Date().toISOString(),
  })),
  getAgentActionByIdForCreator: vi.fn().mockImplementation(async (creatorId, actionId) => ({
    id: actionId,
    creator_id: creatorId,
    action_type: "generate_pitch",
    status: "pending",
    description: "Pitch Acme",
    input: { preview: "Draft preview", params: {} },
    output: null,
    cost_cents: 0,
    requires_approval: true,
    approved_at: null,
    executed_at: null,
    created_at: new Date().toISOString(),
  })),
  listPendingAgentActionsForCreator: vi.fn().mockResolvedValue([]),
  updateAgentActionStatus: vi.fn(),
}));

import { isTelegramConfigured, splitMessage } from "../../../src/bot/telegram.js";
import { getPendingApprovalByAction, storePendingApproval } from "../../../src/bot/approval.js";

describe("telegram configuration", () => {
  it("exposes whether telegram is configured", () => {
    expect(typeof isTelegramConfigured()).toBe("boolean");
  });
});

describe("telegram approval callback payloads", () => {
  it("uses creator-scoped callback data for approval buttons", async () => {
    const action = await storePendingApproval({
      id: "action-tele",
      creatorId: "creator-tele",
      actionId: "action-tele",
      type: "generate_pitch",
      description: "Pitch Acme",
      preview: "Draft preview",
      input: {},
    });

    expect(action.actionId).toBe("action-tele");
    expect((await getPendingApprovalByAction("creator-tele", "action-tele"))?.type).toBe(
      "generate_pitch"
    );
  });
});

describe("splitMessage", () => {
  it("returns a single chunk for short messages", () => {
    const result = splitMessage("Hello world");
    expect(result).toEqual(["Hello world"]);
  });

  it("splits long messages at newlines", () => {
    const line = "A".repeat(100) + "\n";
    const longText = line.repeat(50); // 5050 chars
    const result = splitMessage(longText, 4096);

    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(4096);
    }
  });

  it("hard-splits when no newlines or spaces are available", () => {
    const longText = "A".repeat(5000);
    const result = splitMessage(longText, 4096);

    expect(result.length).toBe(2);
    expect(result[0].length).toBe(4096);
    expect(result[1].length).toBe(904);
  });

  it("handles empty string", () => {
    expect(splitMessage("")).toEqual([""]);
  });

  it("handles exact limit", () => {
    const text = "A".repeat(4096);
    expect(splitMessage(text)).toEqual([text]);
  });
});
