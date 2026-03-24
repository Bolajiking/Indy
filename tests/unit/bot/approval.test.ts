import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/queries/agent-actions.js", () => ({
  createPendingAgentAction: vi.fn(),
  getAgentActionByIdForCreator: vi.fn(),
  listPendingAgentActionsForCreator: vi.fn(),
  updateAgentActionStatus: vi.fn(),
}));

import {
  createPendingAgentAction,
  getAgentActionByIdForCreator,
  listPendingAgentActionsForCreator,
  updateAgentActionStatus,
} from "../../../src/db/queries/agent-actions.js";
import {
  getPendingApproval,
  getPendingApprovalsForCreator,
  markApprovalApproved,
  markApprovalExecuted,
  markApprovalSkipped,
  storePendingApproval,
} from "../../../src/bot/approval.js";

describe("approval store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const loaded = await getPendingApproval("creator-1:action-1");
    expect(loaded?.preview).toBe("Draft pitch for Acme");

    const pending = await getPendingApprovalsForCreator("creator-1");
    expect(pending).toHaveLength(1);
    expect(pending[0]?.type).toBe("generate_pitch");
  });

  it("updates approval status transitions", async () => {
    await markApprovalApproved("action-1");
    await markApprovalExecuted("action-1", { message: "done" });
    await markApprovalSkipped("action-2");

    expect(updateAgentActionStatus).toHaveBeenNthCalledWith(1, "action-1", {
      status: "approved",
      approved_at: expect.any(String),
    });
    expect(updateAgentActionStatus).toHaveBeenNthCalledWith(2, "action-1", {
      status: "executed",
      executed_at: expect.any(String),
      output: { message: "done" },
    });
    expect(updateAgentActionStatus).toHaveBeenNthCalledWith(3, "action-2", {
      status: "skipped",
    });
  });
});
