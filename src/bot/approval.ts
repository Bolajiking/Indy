import {
  createPendingAgentAction,
  getAgentActionByIdForCreator,
  listPendingAgentActionsForCreator,
  updateAgentActionStatus,
} from "../db/queries/agent-actions.js";

export interface ApprovalAction {
  id: string;
  creatorId: string;
  actionId: string;
  type: string;
  description: string;
  preview: string;
  input: Record<string, unknown>;
  /** Continuation context — present when the action originated from an agent loop */
  continuation?: {
    toolUseId: string;
    messageHistory: import("@anthropic-ai/sdk").Anthropic.MessageParam[];
    systemPrompt: string;
  };
}

function mapAgentAction(action: {
  id: string;
  creator_id: string;
  action_type: string;
  description: string;
  input: Record<string, unknown> | null;
}): ApprovalAction {
  const input = (action.input ?? {}) as Record<string, unknown>;
  const continuation = input.continuation as ApprovalAction["continuation"] | undefined;
  return {
    id: action.id,
    creatorId: action.creator_id,
    actionId: action.id,
    type: action.action_type,
    description: action.description,
    preview: typeof input.preview === "string" ? input.preview : action.description,
    input: (input.params as Record<string, unknown> | undefined) ?? {},
    ...(continuation ? { continuation } : {}),
  };
}

export async function storePendingApproval(
  action: Omit<ApprovalAction, "id"> & { id?: string }
): Promise<ApprovalAction> {
  const actionId = action.id ?? action.actionId;
  const created = await createPendingAgentAction({
    id: actionId,
    creator_id: action.creatorId,
    action_type: action.type,
    description: action.description,
    input: {
      preview: action.preview,
      params: action.input,
      ...(action.continuation ? { continuation: action.continuation } : {}),
    },
  });

  return mapAgentAction(created);
}

export async function getPendingApproval(
  key: string
): Promise<ApprovalAction | undefined> {
  const [creatorId, actionId] = key.split(":");
  if (!creatorId || !actionId) {
    return undefined;
  }

  return getPendingApprovalByAction(creatorId, actionId);
}

export async function getPendingApprovalByAction(
  creatorId: string,
  actionId: string
): Promise<ApprovalAction | undefined> {
  const action = await getAgentActionByIdForCreator(creatorId, actionId);
  if (!action || action.status !== "pending") {
    return undefined;
  }

  return mapAgentAction(action);
}

export async function markApprovalApproved(actionId: string): Promise<void> {
  await updateAgentActionStatus(actionId, {
    status: "approved",
    approved_at: new Date().toISOString(),
  });
}

export async function markApprovalSkipped(actionId: string): Promise<void> {
  await updateAgentActionStatus(actionId, {
    status: "skipped",
  });
}

export async function markApprovalFailed(
  actionId: string,
  errorMessage: string
): Promise<void> {
  await updateAgentActionStatus(actionId, {
    status: "failed",
    output: { error: errorMessage },
  });
}

export async function markApprovalExecuted(
  actionId: string,
  output: Record<string, unknown>,
  costCents?: number
): Promise<void> {
  await updateAgentActionStatus(actionId, {
    status: "executed",
    executed_at: new Date().toISOString(),
    output,
    ...(typeof costCents === "number" ? { cost_cents: costCents } : {}),
  });
}

export async function getPendingApprovalsForCreator(
  creatorId: string
): Promise<ApprovalAction[]> {
  const actions = await listPendingAgentActionsForCreator(creatorId);
  return actions.map(mapAgentAction);
}
