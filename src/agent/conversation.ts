import { storePendingApproval } from "../bot/approval.js";
import { getCreatorById } from "../db/queries/creators.js";
import { saveMessage } from "../db/queries/messages.js";
import { isJsonObject, type JsonObject } from "../db/json.js";
import { asAgentChannel, type AgentResponse } from "./types.js";
import { runAgentOS } from "./os/index.js";
import { rememberCreatorContext } from "./os/creator-memory.js";
import { syncCreatorConnectedIdentities } from "./connected-identities.js";

export async function processCreatorMessage(input: {
  creatorId: string;
  text: string;
  metadata?: JsonObject;
  walletId?: string | null;
  walletAddress?: string | null;
}): Promise<AgentResponse> {
  // If both wallet params are already provided (e.g. from the bot handler), skip the DB
  // lookup — we have what we need. If either is missing, look up the creator to get them.
  const bothWalletParamsProvided = Boolean(
    input.walletId && input.walletAddress,
  );
  const creator = bothWalletParamsProvided
    ? null
    : await getCreatorById(input.creatorId);

  await saveMessage({
    creator_id: input.creatorId,
    role: "user",
    content: input.text,
    metadata: isJsonObject(input.metadata) ? input.metadata : {},
  });
  const messageMetadata = isJsonObject(input.metadata) ? input.metadata : {};

  const agentResponse = await runAgentOS({
    creatorId: input.creatorId,
    userMessage: input.text,
    walletId: input.walletId ?? creator?.wallet_id ?? undefined,
    walletAddress: input.walletAddress ?? creator?.wallet_address ?? undefined,
    channel: asAgentChannel(messageMetadata.platform),
  });

  await saveMessage({
    creator_id: input.creatorId,
    role: "assistant",
    content: agentResponse.text,
    metadata: {
      ...messageMetadata,
      requiresApproval: agentResponse.requiresApproval,
      ...(agentResponse.connections && agentResponse.connections.length > 0
        ? { connections: agentResponse.connections }
        : {}),
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

  // Capture any durable facts the creator shared, so the agent remembers them
  // next time. Fire-and-forget + self-gated (skips trivial messages) so it never
  // blocks the response or wastes tokens on commands/approvals.
  void rememberCreatorContext({
    creatorId: input.creatorId,
    userText: input.text,
    agentText: agentResponse.text,
  });

  // Safety net: capture connected-app identities (e.g. YouTube channel) if a
  // connection was made outside the dashboard poll. Idempotent + non-blocking.
  void syncCreatorConnectedIdentities(input.creatorId);

  return agentResponse;
}
