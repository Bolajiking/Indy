import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/queries/agent-actions.js", () => ({
  createPendingAgentAction: vi.fn(),
  getAgentActionByIdForCreator: vi.fn(),
  listPendingAgentActionsForCreator: vi.fn(),
  updateAgentActionStatus: vi.fn(),
  updatePendingAgentActionStatus: vi.fn().mockResolvedValue({}),
  claimPendingAgentActionForCreator: vi.fn(),
}));

import {
  createPendingAgentAction,
  getAgentActionByIdForCreator,
  listPendingAgentActionsForCreator,
  updateAgentActionStatus,
  claimPendingAgentActionForCreator,
} from "../../../src/db/queries/agent-actions.js";
import {
  getPendingApproval,
  getPendingApprovalByAction,
  getPendingApprovalsForCreator,
  claimPendingApproval,
  markApprovalExecuted,
  markApprovalSkipped,
  storePendingApproval,
} from "../../../src/bot/approval.js";

describe("approval store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves approval actions via agent_actions persistence", async () => {
    vi.mocked(createPendingAgentAction).mockResolvedValue({
      id: "action-1",
      creator_id: "creator-1",
      action_type: "generate_pitch",
      status: "pending",
      description: "Send a pitch to Acme",
      input: { preview: "Draft pitch for Acme", params: { brand: "Acme" } },
      output: null,
      cost_cents: 0,
      requires_approval: true,
      approved_at: null,
      executed_at: null,
      expires_at: "2026-07-10T12:15:00.000Z",
      created_at: new Date().toISOString(),
    } as never);
    vi.mocked(getAgentActionByIdForCreator).mockResolvedValue({
      id: "action-1",
      creator_id: "creator-1",
      action_type: "generate_pitch",
      status: "pending",
      description: "Send a pitch to Acme",
      input: { preview: "Draft pitch for Acme", params: { brand: "Acme" } },
      output: null,
      cost_cents: 0,
      requires_approval: true,
      approved_at: null,
      executed_at: null,
      expires_at: "2026-07-10T12:15:00.000Z",
      created_at: new Date().toISOString(),
    } as never);
    vi.mocked(listPendingAgentActionsForCreator).mockResolvedValue([
      {
        id: "action-1",
        creator_id: "creator-1",
        action_type: "generate_pitch",
        status: "pending",
        description: "Send a pitch to Acme",
        input: { preview: "Draft pitch for Acme", params: { brand: "Acme" } },
        output: null,
        cost_cents: 0,
        requires_approval: true,
        approved_at: null,
        executed_at: null,
        expires_at: "2026-07-10T12:15:00.000Z",
        created_at: new Date().toISOString(),
      } as never,
    ]);

    const stored = await storePendingApproval({
      creatorId: "creator-1",
      actionId: "action-1",
      type: "generate_pitch",
      description: "Send a pitch to Acme",
      preview: "Draft pitch for Acme",
      input: { brand: "Acme" },
    });

    expect(stored.id).toBe("action-1");
    expect(createPendingAgentAction).toHaveBeenCalledWith(
      expect.objectContaining({
        expires_at: "2026-07-10T12:15:00.000Z",
      }),
    );

    const loaded = await getPendingApproval("creator-1:action-1");
    expect(loaded?.preview).toBe("Draft pitch for Acme");

    const pending = await getPendingApprovalsForCreator("creator-1");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.type).toBe("generate_pitch");
  });

  it("atomically claims only an unexpired pending action for its creator", async () => {
    vi.mocked(claimPendingAgentActionForCreator).mockResolvedValue({
      id: "action-1",
      creator_id: "creator-1",
      action_type: "generate_pitch",
      status: "approved",
      description: "Send a pitch to Acme",
      input: { preview: "Draft pitch", params: {} },
      output: null,
      cost_cents: 0,
      requires_approval: true,
      approved_at: "2026-07-10T12:00:00.000Z",
      executed_at: null,
      expires_at: "2026-07-10T12:15:00.000Z",
      created_at: "2026-07-10T12:00:00.000Z",
    } as never);

    const approved = await claimPendingApproval("creator-1", "action-1");
    await markApprovalExecuted("action-1", { message: "done" });
    await markApprovalSkipped("action-2");

    expect(approved?.actionId).toBe("action-1");
    expect(claimPendingAgentActionForCreator).toHaveBeenCalledWith(
      "creator-1",
      "action-1",
      "2026-07-10T12:00:00.000Z",
    );
    expect(updateAgentActionStatus).toHaveBeenNthCalledWith(1, "action-1", {
      status: "executed",
      executed_at: expect.any(String),
      output: { message: "done" },
    });
  });

  it("reports when the approval claim was already taken or expired", async () => {
    vi.mocked(claimPendingAgentActionForCreator).mockResolvedValue(null);

    await expect(
      claimPendingApproval("creator-1", "action-1"),
    ).resolves.toBeUndefined();
  });

  it("does not return an expired pending approval from a stale query response", async () => {
    vi.mocked(getAgentActionByIdForCreator).mockResolvedValue({
      id: "action-expired",
      creator_id: "creator-1",
      action_type: "email_sender",
      status: "pending",
      description: "Send a pitch",
      input: { preview: "Pitch", params: {} },
      output: null,
      cost_cents: 0,
      requires_approval: true,
      approved_at: null,
      executed_at: null,
      expires_at: "2026-07-10T11:59:59.999Z",
      created_at: "2026-07-10T11:00:00.000Z",
    } as never);

    await expect(
      getPendingApprovalByAction("creator-1", "action-expired"),
    ).resolves.toBeUndefined();
  });
});
