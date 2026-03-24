import {
  getPendingApprovalByAction,
  markApprovalApproved,
  markApprovalExecuted,
  markApprovalFailed,
} from "../bot/approval.js";
import { getCreatorById } from "../db/queries/creators.js";
import { createMppClient, getOnChainBalance } from "../wallet/mpp.js";
import { resolveWalletForCreator } from "../wallet/privy.js";
import { getTool, type ToolContext } from "./tools/registry.js";
import { runAgentLoop } from "./loop.js";
import pino from "pino";

const log = pino({ name: "agent:approval-execution" });

export class ApprovalExecutionError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "tool_not_found"
      | "creator_not_found"
      | "wallet_not_ready"
      | "insufficient_funds"
      | "execution_failed",
    message: string
  ) {
    super(message);
    this.name = "ApprovalExecutionError";
  }
}

export async function executePendingApprovalAction(
  creatorId: string,
  actionId: string
): Promise<{
  message: string;
  costCents?: number;
}> {
  const approval = await getPendingApprovalByAction(creatorId, actionId);
  if (!approval) {
    throw new ApprovalExecutionError("not_found", "That action has expired or was already handled.");
  }

  const tool = getTool(approval.type);
  if (!tool) {
    throw new ApprovalExecutionError(
      "tool_not_found",
      `Could not find tool "${approval.type}".`
    );
  }

  const creator = await getCreatorById(creatorId);
  if (!creator) {
    throw new ApprovalExecutionError(
      "creator_not_found",
      "Could not find your creator profile."
    );
  }

  let toolContext: ToolContext | null = null;
  if (creator.wallet_id && creator.wallet_address) {
    const wallet = await resolveWalletForCreator(
      creator.id,
      creator.wallet_id,
      creator.wallet_address
    );
    if (wallet) {
      // Pre-flight: check on-chain balance before creating the MPP client.
      // Apply a 7s timeout — a hung RPC should not block the approval flow.
      try {
        const balancePromise = getOnChainBalance(wallet.address);
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Balance check timed out")), 7_000)
        );
        const { balanceCents, balanceFormatted } = await Promise.race([balancePromise, timeout]);
        if (tool.costCategory === "mpp" && balanceCents < tool.maxCostPerUseCents) {
          const shortfallFormatted = `$${((tool.maxCostPerUseCents - balanceCents) / 100).toFixed(2)}`;
          throw new ApprovalExecutionError(
            "insufficient_funds",
            `Your wallet needs at least ${shortfallFormatted} more USDC to complete this action. ` +
            `Current balance: ${balanceFormatted}. Send USDC to ${wallet.address} to continue.`
          );
        }
      } catch (err) {
        if (err instanceof ApprovalExecutionError) throw err;
        // Balance check failed (network issue) — proceed anyway, MPP will catch it
        log.warn({ err, creatorId }, "Balance pre-flight check failed — proceeding");
      }

      const mppClient = await createMppClient(
        creator.id,
        wallet.walletId,
        wallet.address as `0x${string}`
      );
      toolContext = { creatorId: creator.id, mppFetch: mppClient.fetch };
    }
  }

  if (!toolContext) {
    throw new ApprovalExecutionError(
      "wallet_not_ready",
      "No wallet is configured for this creator yet."
    );
  }

  // Mark approved first to act as an optimistic lock preventing double-execution.
  // If execution subsequently fails we mark it as failed (not left stuck in "approved").
  await markApprovalApproved(actionId);

  let result: Awaited<ReturnType<typeof tool.execute>>;
  try {
    result = await tool.execute(approval.input, toolContext);
  } catch (execErr: unknown) {
    const msg = execErr instanceof Error ? execErr.message : "Unexpected error during execution";
    log.error({ execErr, creatorId, actionId }, "Tool execution threw — marking approval failed");
    await markApprovalFailed(actionId, msg).catch((e) =>
      log.warn({ e }, "Could not mark approval as failed after execution error")
    );
    throw new ApprovalExecutionError("execution_failed", "The approved action could not be completed.");
  }

  if (!result.success) {
    const failMsg = typeof result.data === "string" ? result.data : "Tool returned a failure result";
    await markApprovalFailed(actionId, failMsg).catch((e) =>
      log.warn({ e }, "Could not mark approval as failed after unsuccessful result")
    );
    throw new ApprovalExecutionError(
      "execution_failed",
      "The approved action could not be completed."
    );
  }

  const resultString =
    typeof result.data === "string"
      ? result.data
      : JSON.stringify(result.data);

  await markApprovalExecuted(
    actionId,
    { success: true, data: result.data },
    result.costCents
  );

  // If we have continuation context, re-enter the agent loop so Claude can
  // produce a natural follow-up response rather than a raw tool result string.
  if (approval.continuation) {
    const { toolUseId, messageHistory, systemPrompt } = approval.continuation;
    log.info({ creatorId, actionId, toolUseId }, "Re-entering agent loop after approval");

    try {
      const loopResult = await runAgentLoop({
        systemPrompt,
        messages: [
          ...messageHistory,
          {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolUseId,
                content: resultString,
              },
            ],
          },
        ],
        toolContext,
      });

      return {
        message: loopResult.text,
        ...(typeof result.costCents === "number" ? { costCents: result.costCents } : {}),
      };
    } catch (err: unknown) {
      log.warn({ err, creatorId }, "Agent loop re-entry failed — returning raw result");
      // Fall through to return raw result
    }
  }

  return {
    message: resultString || "Action completed successfully.",
    ...(typeof result.costCents === "number" ? { costCents: result.costCents } : {}),
  };
}
