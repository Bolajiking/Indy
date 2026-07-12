import { supabase } from "../client.js";
import { DealStage } from "../../config/constants.js";
import type { JsonObject } from "../json.js";

export interface Deal {
  id: string;
  creator_id: string;
  brand_name: string;
  brand_contact_email: string | null;
  brand_contact_name: string | null;
  brand_domain: string | null;
  stage: DealStage;
  fit_score: number | null;
  estimated_value_cents: number | null;
  actual_value_cents: number | null;
  source_url: string | null;
  source_type: string | null;
  source_confidence: number | null;
  source_evidence: JsonObject[];
  deliverables: JsonObject[];
  deadline_at: string | null;
  follow_up_at: string | null;
  probability: number | null;
  next_action: string | null;
  agent_provenance: JsonObject;
  archived_at: string | null;
  pitch_text: string | null;
  pitch_sent_at: string | null;
  response_text: string | null;
  responded_at: string | null;
  contract_notes: string | null;
  notes: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface CreateDealInput {
  creator_id: string;
  brand_name: string;
  brand_contact_email?: string | null;
  brand_contact_name?: string | null;
  brand_domain?: string | null;
  fit_score?: number | null;
  estimated_value_cents?: number | null;
  actual_value_cents?: number | null;
  source_url?: string | null;
  source_type?: string | null;
  source_confidence?: number | null;
  source_evidence?: JsonObject[];
  deliverables?: JsonObject[];
  deadline_at?: string | null;
  follow_up_at?: string | null;
  probability?: number | null;
  next_action?: string | null;
  agent_provenance?: JsonObject;
  archived_at?: string | null;
  pitch_text?: string | null;
  pitch_sent_at?: string | null;
  response_text?: string | null;
  responded_at?: string | null;
  contract_notes?: string | null;
  notes?: string | null;
  metadata?: JsonObject;
}

export type UpdateDealInput = Partial<Omit<CreateDealInput, "creator_id">> & {
  stage?: DealStage;
};

/**
 * Idempotent deal creation — prevents duplicates for the same creator + brand.
 *
 * If a non-terminal deal (not completed/lost) already exists for this creator and
 * brand name (case-insensitive), we update it with any richer data provided
 * (higher fit score, better notes, contact info) rather than inserting a duplicate.
 * Terminal deals (completed/lost) are left alone — a new cycle creates a fresh entry.
 */
export async function createDeal(dealData: CreateDealInput): Promise<Deal> {
  const TERMINAL_STAGES: DealStage[] = ["completed", "lost"];

  // Check for existing non-terminal deal for this creator + brand
  const { data: existing } = await supabase
    .from("deals")
    .select("*")
    .eq("creator_id", dealData.creator_id)
    .ilike("brand_name", dealData.brand_name.trim())
    .not("stage", "in", `(${TERMINAL_STAGES.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Update only fields that are explicitly better/richer
    const updates: Partial<Deal> = { updated_at: new Date().toISOString() };
    if (
      dealData.fit_score != null &&
      (existing.fit_score == null || dealData.fit_score > existing.fit_score)
    ) {
      updates.fit_score = dealData.fit_score;
    }
    if (
      dealData.estimated_value_cents != null &&
      (existing.estimated_value_cents == null ||
        dealData.estimated_value_cents > existing.estimated_value_cents)
    ) {
      updates.estimated_value_cents = dealData.estimated_value_cents;
    }
    if (dealData.notes && !existing.notes) {
      updates.notes = dealData.notes;
    }
    if (dealData.brand_contact_email && !existing.brand_contact_email) {
      updates.brand_contact_email = dealData.brand_contact_email;
    }
    if (dealData.brand_contact_name && !existing.brand_contact_name) {
      updates.brand_contact_name = dealData.brand_contact_name;
    }
    if (dealData.brand_domain && !existing.brand_domain) {
      updates.brand_domain = dealData.brand_domain;
    }
    if (dealData.source_url && !existing.source_url) {
      updates.source_url = dealData.source_url;
    }
    if (dealData.source_evidence?.length && !existing.source_evidence?.length) {
      updates.source_evidence = dealData.source_evidence;
    }
    if (dealData.next_action && !existing.next_action) {
      updates.next_action = dealData.next_action;
    }
    if (dealData.follow_up_at && !existing.follow_up_at) {
      updates.follow_up_at = dealData.follow_up_at;
    }

    const { data: updated, error: updateError } = await supabase
      .from("deals")
      .update(updates)
      .eq("id", existing.id)
      .eq("creator_id", dealData.creator_id)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  // No existing deal — insert fresh
  const payload = {
    stage: "discovered" as const,
    ...dealData,
    brand_name: dealData.brand_name.trim(),
    source_evidence: dealData.source_evidence ?? [],
    deliverables: dealData.deliverables ?? [],
    agent_provenance: dealData.agent_provenance ?? {},
    metadata: dealData.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("deals")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDeal(
  creatorId: string,
  dealId: string,
  updates: UpdateDealInput,
): Promise<Deal | null> {
  const payload = {
    ...updates,
    ...(updates.brand_name ? { brand_name: updates.brand_name.trim() } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("deals")
    .update(payload)
    .eq("id", dealId)
    .eq("creator_id", creatorId)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateDealStage(
  creatorId: string,
  dealId: string,
  stage: DealStage,
  extra?: Partial<Deal>,
): Promise<Deal | null> {
  const { data, error } = await supabase
    .from("deals")
    .update({ stage, ...extra, updated_at: new Date().toISOString() })
    .eq("id", dealId)
    .eq("creator_id", creatorId)
    .select()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getDealsForCreator(
  creatorId: string,
  stage?: DealStage,
): Promise<Deal[]> {
  let query = supabase
    .from("deals")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  if (stage) {
    query = query.eq("stage", stage);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getDealByIdForCreator(
  creatorId: string,
  dealId: string,
): Promise<Deal | null> {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("id", dealId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data;
}
