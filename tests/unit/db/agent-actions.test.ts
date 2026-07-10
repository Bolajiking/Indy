import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/client.js", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../../../src/db/client.js";
import { claimPendingAgentActionForCreator } from "../../../src/db/queries/agent-actions.js";

describe("agent action approval claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses one creator-scoped pending-to-approved update with an expiry guard", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const gt = vi.fn().mockReturnValue({ select });
    const pendingStatus = vi.fn().mockReturnValue({ gt });
    const actionId = vi.fn().mockReturnValue({ eq: pendingStatus });
    const creatorId = vi.fn().mockReturnValue({ eq: actionId });
    const update = vi.fn().mockReturnValue({ eq: creatorId });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    await expect(
      claimPendingAgentActionForCreator(
        "creator-1",
        "action-1",
        "2026-07-10T12:00:00.000Z",
      ),
    ).resolves.toBeNull();

    expect(supabase.from).toHaveBeenCalledWith("agent_actions");
    expect(update).toHaveBeenCalledWith({
      status: "approved",
      approved_at: "2026-07-10T12:00:00.000Z",
    });
    expect(creatorId).toHaveBeenCalledWith("creator_id", "creator-1");
    expect(actionId).toHaveBeenCalledWith("id", "action-1");
    expect(pendingStatus).toHaveBeenCalledWith("status", "pending");
    expect(gt).toHaveBeenCalledWith("expires_at", "2026-07-10T12:00:00.000Z");
  });
});
