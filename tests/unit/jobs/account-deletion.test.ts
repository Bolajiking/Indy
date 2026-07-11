import { describe, expect, it, vi } from "vitest";
import {
  createAccountDeletionProcessor,
  getAccountDeletionJobId,
  retryAccountDeletion,
} from "../../../src/jobs/account-deletion.js";

function dependencies(overrides = {}) {
  return {
    getLifecycle: vi.fn(async () => ({ state: "requested" })),
    updateLifecycle: vi.fn(async () => undefined),
    getCreatorSnapshot: vi.fn(async () => ({
      id: "creator-1",
      privy_user_id: "did:privy:user-1",
      wallet_id: "agent-wallet-1",
      wallet_address: "0xabc",
    })),
    revokeComposio: vi.fn(async () => undefined),
    revokeNative: vi.fn(async () => undefined),
    deletePrivyUser: vi.fn(async () => undefined),
    deleteCreator: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("account deletion job", () => {
  it("uses a deterministic job id", () => {
    expect(getAccountDeletionJobId("creator-1")).toBe(
      getAccountDeletionJobId("creator-1"),
    );
  });

  it("revives the existing deterministic failed job instead of silently deduping", async () => {
    const retry = vi.fn(async () => undefined);
    const getState = vi.fn(async () => "failed");
    const queue = {
      add: vi.fn(),
      getJob: vi.fn(async () => ({ retry, getState })),
    };
    const markRequested = vi.fn(async () => undefined);
    await retryAccountDeletion("creator-1", queue as never, markRequested);
    expect(markRequested).toHaveBeenCalledWith("creator-1");
    expect(queue.getJob).toHaveBeenCalledWith(
      getAccountDeletionJobId("creator-1"),
    );
    expect(retry).toHaveBeenCalledOnce();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("progresses requested → revoking-connections → deleting → completed and deletes creator last", async () => {
    const order: string[] = [];
    const deps = dependencies({
      updateLifecycle: vi.fn(async (_id, state) => order.push(state)),
      revokeComposio: vi.fn(async () => order.push("composio")),
      revokeNative: vi.fn(async () => order.push("native")),
      deletePrivyUser: vi.fn(async () => order.push("privy")),
      deleteCreator: vi.fn(async () => order.push("creator-last")),
    });
    await createAccountDeletionProcessor(deps)({
      data: { creatorId: "creator-1" },
    });
    expect(order).toEqual([
      "revoking-connections",
      "composio",
      "native",
      "deleting",
      "privy",
      "creator-last",
      "completed",
    ]);
  });

  it("persists vendor/on-chain residuals and never claims wallet erasure", async () => {
    const deps = dependencies();
    await createAccountDeletionProcessor(deps)({
      data: { creatorId: "creator-1" },
    });
    expect(deps.updateLifecycle).toHaveBeenLastCalledWith(
      "creator-1",
      "completed",
      expect.objectContaining({
        residuals: expect.arrayContaining([
          expect.objectContaining({ kind: "agent-wallet" }),
          expect.objectContaining({
            kind: "on-chain-address",
            identifier: "0xabc",
          }),
          expect.objectContaining({ kind: "archived-embedded-wallet" }),
        ]),
      }),
    );
    const completed = deps.updateLifecycle.mock.calls.at(-1)?.[2];
    expect(JSON.stringify(completed)).not.toContain("agent-wallet-1");
    expect(JSON.stringify(completed)).not.toContain("did:privy:user-1");
  });

  it("stores retryable-failure and resumes without recreating the request", async () => {
    const deps = dependencies({
      revokeComposio: vi.fn(async () => {
        throw new Error("temporary provider failure");
      }),
    });
    await expect(
      createAccountDeletionProcessor(deps)({
        data: { creatorId: "creator-1" },
      }),
    ).rejects.toThrow("temporary provider failure");
    expect(deps.updateLifecycle).toHaveBeenLastCalledWith(
      "creator-1",
      "retryable-failure",
      expect.objectContaining({ error: "Account cleanup temporarily failed" }),
    );
    expect(deps.deleteCreator).not.toHaveBeenCalled();
  });
});
