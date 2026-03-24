import { storePendingApproval } from "../bot/approval.js";
import { getCreatorById } from "../db/queries/creators.js";
import { saveMessage } from "../db/queries/messages.js";
import { runAgent, type AgentResponse } from "./orchestrator.js";
import { runAgentOS } from "./os/index.js";

export async function processCreatorMessage(input: {
  creatorId: string;
  text: string;
  metadata?: Record<string, unknown>;
  walletId?: string | null;
  walletAddress?: string | null;
}): Promise<AgentResponse> {
  // If both wallet params are already provided (e.g. from the bot handler), skip the DB
  // lookup — we have what we need. If either is missing, look up the creator to get them.
  const bothWalletParamsProvided = Boolean(input.walletId && input.walletAddress);
  const creator = bothWalletParamsProvided ? null : await getCreatorById(input.creatorId);

  await saveMessage({
    creator_id: input.creatorId,
    role: "user",
    content: input.text,
    metadata: input.metadata ?? {},
  });

  const agentResponse = await runAgentOS({
    creatorId: input.creatorId,
    userMessage: input.text,
    walletId: input.walletId ?? creator?.wallet_id ?? undefined,
    walletAddress: input.walletAddress ?? creator?.wallet_address ?? undefined,
  });

  await saveMessage({
    creator_id: input.creatorId,
    role: "assistant",
    content: agentResponse.text,
    metadata: {
      ...(input.metadata ?? {}),
      requiresApproval: agentResponse.requiresApproval,
    },
  });

  if (agentResponse.requiresApproval && agentResponse.pendingAction) {
    await storePendingApproval({
      id: agentResponse.pendingAction.id,
      creatorId: input.creatorId,
      actionId: agentResponse.pendingAction.id,
      type: agentResponse.pendingAction.type,
      description: agentResponse.pendingAction.description,
      preview: agentResponse.text,
      input: agentResponse.pendingAction.input,
      continuation:
        agentResponse.pendingAction.toolUseId &&
        agentResponse.pendingAction.messageHistory &&
        agentResponse.pendingAction.systemPrompt
          ? {
              toolUseId: agentResponse.pendingAction.toolUseId,
              messageHistory: agentResponse.pendingAction.messageHistory,
              systemPrompt: agentResponse.pendingAction.systemPrompt,
            }
          : undefined,
    });
  }

  return agentResponse;
}
