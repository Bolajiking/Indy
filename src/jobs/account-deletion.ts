import { createHash } from "node:crypto";
import type { Queue } from "bullmq";
import { getAgentQueue } from "./queue.js";
import {
  deleteCreatorLast,
  deleteNativeConnections,
  getAccountDeletion,
  getDeletionCreatorSnapshot,
  updateAccountDeletion,
  type AccountDeletionResidual,
  type AccountDeletionState,
} from "../db/queries/account-lifecycle.js";
import { disconnectAllComposioConnections } from "../integrations/composio.js";
import { deletePrivyUser } from "../wallet/privy.js";

export function getAccountDeletionJobId(creatorId: string): string {
  return `account-delete-${createHash("sha256").update(creatorId).digest("hex")}`;
}

export async function enqueueAccountDeletion(
  creatorId: string,
  queue: Pick<Queue, "add"> = getAgentQueue(),
): Promise<void> {
  await queue.add(
    "account-deletion",
    { creatorId },
    {
      jobId: getAccountDeletionJobId(creatorId),
      attempts: 8,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 604_800, count: 10_000 },
      removeOnFail: { age: 2_592_000, count: 10_000 },
    },
  );
}

export async function retryAccountDeletion(
  creatorId: string,
  queue: Pick<Queue, "add" | "getJob"> = getAgentQueue(),
  markRequested: (creatorId: string) => Promise<void> = async (id) =>
    updateAccountDeletion(id, "requested", { error: null }),
): Promise<void> {
  await markRequested(creatorId);
  const jobId = getAccountDeletionJobId(creatorId);
  const job = await queue.getJob(jobId);
  if (!job) {
    await enqueueAccountDeletion(creatorId, queue);
    return;
  }
  const state = await job.getState();
  if (state === "failed") await job.retry();
}

interface Dependencies {
  getLifecycle: (
    creatorId: string,
  ) => Promise<{ state: AccountDeletionState } | null>;
  updateLifecycle: (
    creatorId: string,
    state: AccountDeletionState,
    details?: { residuals?: AccountDeletionResidual[]; error?: string | null },
  ) => Promise<void>;
  getCreatorSnapshot: typeof getDeletionCreatorSnapshot;
  revokeComposio: (creatorId: string) => Promise<void>;
  revokeNative: (creatorId: string) => Promise<void>;
  deletePrivyUser: (privyUserId: string) => Promise<void>;
  deleteCreator: (creatorId: string) => Promise<void>;
}

const defaults: Dependencies = {
  getLifecycle: getAccountDeletion,
  updateLifecycle: updateAccountDeletion,
  getCreatorSnapshot: getDeletionCreatorSnapshot,
  revokeComposio: async (id) =>
    void (await disconnectAllComposioConnections(id)),
  revokeNative: deleteNativeConnections,
  deletePrivyUser,
  deleteCreator: deleteCreatorLast,
};

export function createAccountDeletionProcessor(deps: Dependencies = defaults) {
  return async (job: { data: { creatorId: string } }): Promise<void> => {
    const { creatorId } = job.data;
    const lifecycle = await deps.getLifecycle(creatorId);
    if (!lifecycle || lifecycle.state === "completed") return;
    const snapshot = await deps.getCreatorSnapshot(creatorId);

    try {
      await deps.updateLifecycle(creatorId, "revoking-connections", {
        error: null,
      });
      await deps.revokeComposio(creatorId);
      await deps.revokeNative(creatorId);
      await deps.updateLifecycle(creatorId, "deleting");
      if (snapshot.privy_user_id)
        await deps.deletePrivyUser(snapshot.privy_user_id);

      const residuals: AccountDeletionResidual[] = [];
      if (snapshot.wallet_id)
        residuals.push({
          kind: "agent-wallet",
          detail:
            "Policy-backed agent wallet has no supported delete method and may remain with Privy.",
        });
      if (snapshot.wallet_address)
        residuals.push({
          kind: "on-chain-address",
          identifier: snapshot.wallet_address,
          detail:
            "Public blockchain history is immutable and remains on-chain.",
        });
      if (snapshot.privy_user_id)
        residuals.push({
          kind: "archived-embedded-wallet",
          detail:
            "Privy permanently deletes the user but disassociates and archives embedded wallets rather than deleting them.",
        });

      await deps.deleteCreator(creatorId);
      await deps.updateLifecycle(creatorId, "completed", {
        residuals,
        error: null,
      });
    } catch (error) {
      await deps.updateLifecycle(creatorId, "retryable-failure", {
        error: "Account cleanup temporarily failed",
      });
      throw error;
    }
  };
}
