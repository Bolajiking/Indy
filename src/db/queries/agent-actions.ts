import { supabase } from "../client.js";

export interface AgentAction {
  id: string;
  creator_id: string;
  action_type: string;
  status: string;
  description: string;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  cost_cents: number;
  requires_approval: boolean;
  approved_at: string | null;
  executed_at: string | null;
  created_at: string;
}

export async function createPendingAgentAction(action: {
  id: string;
  creator_id: string;
  action_type: string;
  description: string;
  input: Record<string, unknown>;
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
  actionId: string
): Promise<AgentAction | null> {
  const { data, error } = await supabase
    .from("agent_actions")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("id", actionId)
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
  creatorId: string
): Promise<AgentAction[]> {
  const { data, error } = await supabase
    .from("agent_actions")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function updateAgentActionStatus(
  actionId: string,
  updates: Partial<
    Pick<AgentAction, "status" | "approved_at" | "executed_at" | "output" | "cost_cents">
  >
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
