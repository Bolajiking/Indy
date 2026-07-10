import { supabase } from "../client.js";
import type { JsonObject } from "../json.js";

export interface AgentAction {
  id: string;
  creator_id: string;
  action_type: string;
  status: string;
  description: string;
  input: JsonObject | null;
  output: Record<string, unknown> | null;
  cost_cents: number;
  requires_approval: boolean;
  approved_at: string | null;
  executed_at: string | null;
  expires_at: string;
  created_at: string;
}

export async function createPendingAgentAction(action: {
  id: string;
  creator_id: string;
  action_type: string;
  description: string;
  input: JsonObject;
  expires_at: string;
}): Promise<AgentAction> {
  const { data, error } = await supabase
    .from("agent_actions")
    .insert({
      ...action,
      status: "pending",
      requires_approval: true,
      output: null,
      cost_cents: 0,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAgentActionByIdForCreator(
  creatorId: string,
  actionId: string,
): Promise<AgentAction | null> {
  const { data, error } = await supabase
    .from("agent_actions")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("id", actionId)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data;
}

export async function listPendingAgentActionsForCreator(
  creatorId: string,
): Promise<AgentAction[]> {
  const { data, error } = await supabase
    .from("agent_actions")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function updateAgentActionStatus(
  actionId: string,
  updates: Partial<
    Pick<
      AgentAction,
      "status" | "approved_at" | "executed_at" | "output" | "cost_cents"
    >
  >,
): Promise<AgentAction> {
  const { data, error } = await supabase
    .from("agent_actions")
    .update(updates)
    .eq("id", actionId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePendingAgentActionStatus(
  actionId: string,
  updates: Partial<
    Pick<
      AgentAction,
      "status" | "approved_at" | "executed_at" | "output" | "cost_cents"
    >
  >,
): Promise<AgentAction | null> {
  const { data, error } = await supabase
    .from("agent_actions")
    .update(updates)
    .eq("id", actionId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Claim a creator's pending, unexpired action before any external write. The
 * status and expiry predicates are applied by Postgres in the same update, so
 * competing dashboard and messaging requests cannot both execute it.
 */
export async function claimPendingAgentActionForCreator(
  creatorId: string,
  actionId: string,
  approvedAt: string,
): Promise<AgentAction | null> {
  const { data, error } = await supabase
    .from("agent_actions")
    .update({ status: "approved", approved_at: approvedAt })
    .eq("creator_id", creatorId)
    .eq("id", actionId)
    .eq("status", "pending")
    .gt("expires_at", approvedAt)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
