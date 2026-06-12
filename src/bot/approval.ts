import {
  createPendingAgentAction,
  getAgentActionByIdForCreator,
  listPendingAgentActionsForCreator,
  updateAgentActionStatus,
  updatePendingAgentActionStatus,
} from "../db/queries/agent-actions.js";
import { isJsonObject, toJsonValue, type JsonObject } from "../db/json.js";

export interface ApprovalAction {
  id: string;
  creatorId: string;
  actionId: string;
  type: string;
  description: string;
  preview: string;
  input: JsonObject;
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
    ...(continuation ? { continuation } : {}),
  };
}

export async function storePendingApproval(
  action: Omit<ApprovalAction, "id"> & { id?: string },
): Promise<ApprovalAction> {
  const actionId = action.id ?? action.actionId;
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
  if (!action || action.status !== "pending") {
    return undefined;
  }

  return mapAgentAction(action);
}

export async function markApprovalApproved(actionId: string): Promise<boolean> {
  const updated = await updatePendingAgentActionStatus(actionId, {
    status: "approved",
    approved_at: new Date().toISOString(),
  });

  return Boolean(updated);
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
  return actions.map(mapAgentAction);
}
