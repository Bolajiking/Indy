import {
  claimPendingAgentActionForCreator,
  createPendingAgentAction,
  getAgentActionByIdForCreator,
  listPendingAgentActionsForCreator,
  updateAgentActionStatus,
  updatePendingAgentActionStatus,
} from "../db/queries/agent-actions.js";
import { isJsonObject, toJsonValue, type JsonObject } from "../db/json.js";
import { env } from "../config/env.js";

export interface ApprovalAction {
  id: string;
  creatorId: string;
  actionId: string;
  type: string;
  description: string;
  preview: string;
  input: JsonObject;
  expiresAt?: string;
  /** Continuation context — present when the action originated from an agent loop */
  continuation?: {
    toolUseId: string;
    messageHistory: import("@anthropic-ai/sdk").Anthropic.MessageParam[];
    systemPrompt: string;
  };
}

function isApprovalContinuation(
  value: unknown,
): value is ApprovalAction["continuation"] {
  return (
    isJsonObject(value) &&
    typeof value.toolUseId === "string" &&
    Array.isArray(value.messageHistory) &&
    typeof value.systemPrompt === "string"
  );
}

function mapAgentAction(action: {
  id: string;
  creator_id: string;
  action_type: string;
  description: string;
  input: JsonObject | null;
  expires_at: string;
}): ApprovalAction {
  const input = action.input ?? {};
  const continuation = isApprovalContinuation(input.continuation)
    ? input.continuation
    : undefined;
  return {
    id: action.id,
    creatorId: action.creator_id,
    actionId: action.id,
    type: action.action_type,
    description: action.description,
    preview:
      typeof input.preview === "string" ? input.preview : action.description,
    input: isJsonObject(input.params) ? input.params : {},
    expiresAt: action.expires_at,
    ...(continuation ? { continuation } : {}),
  };
}

function hasUnexpiredApproval(action: { expires_at: string }): boolean {
  const expiry = Date.parse(action.expires_at);
  return Number.isFinite(expiry) && expiry > Date.now();
}

export async function storePendingApproval(
  action: Omit<ApprovalAction, "id"> & { id?: string },
): Promise<ApprovalAction> {
  const actionId = action.id ?? action.actionId;
  const expiresAt = new Date(
    Date.now() + env.APPROVAL_TTL_SECONDS * 1000,
  ).toISOString();
  const input: JsonObject = {
    preview: action.preview,
    params: action.input,
  };
  if (action.continuation) {
    const continuation = toJsonValue(action.continuation);
    if (isJsonObject(continuation)) {
      input.continuation = continuation;
    }
  }

  const created = await createPendingAgentAction({
    id: actionId,
    creator_id: action.creatorId,
    action_type: action.type,
    description: action.description,
    input,
    expires_at: expiresAt,
  });

  return mapAgentAction(created);
}

export async function getPendingApproval(
  key: string,
): Promise<ApprovalAction | undefined> {
  const [creatorId, actionId] = key.split(":");
  if (!creatorId || !actionId) {
    return undefined;
  }

  return getPendingApprovalByAction(creatorId, actionId);
}

export async function getPendingApprovalByAction(
  creatorId: string,
  actionId: string,
): Promise<ApprovalAction | undefined> {
  const action = await getAgentActionByIdForCreator(creatorId, actionId);
  if (!action || action.status !== "pending" || !hasUnexpiredApproval(action)) {
    return undefined;
  }

  return mapAgentAction(action);
}

export async function claimPendingApproval(
  creatorId: string,
  actionId: string,
): Promise<ApprovalAction | undefined> {
  const claimed = await claimPendingAgentActionForCreator(
    creatorId,
    actionId,
    new Date().toISOString(),
  );
  return claimed ? mapAgentAction(claimed) : undefined;
}

export async function markApprovalSkipped(actionId: string): Promise<boolean> {
  const updated = await updatePendingAgentActionStatus(actionId, {
    status: "skipped",
  });

  return Boolean(updated);
}

export async function markApprovalFailed(
  actionId: string,
  errorMessage: string,
): Promise<void> {
  await updateAgentActionStatus(actionId, {
    status: "failed",
    output: { error: errorMessage },
  });
}

export async function markApprovalExecuted(
  actionId: string,
  output: Record<string, unknown>,
  costCents?: number,
): Promise<void> {
  await updateAgentActionStatus(actionId, {
    status: "executed",
    executed_at: new Date().toISOString(),
    output,
    ...(typeof costCents === "number" ? { cost_cents: costCents } : {}),
  });
}

export async function getPendingApprovalsForCreator(
  creatorId: string,
): Promise<ApprovalAction[]> {
  const actions = await listPendingAgentActionsForCreator(creatorId);
  return actions.filter(hasUnexpiredApproval).map(mapAgentAction);
}
