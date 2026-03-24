import { supabase } from "../client.js";
import { DealStage } from "../../config/constants.js";

export interface Deal {
  id: string;
  creator_id: string;
  brand_name: string;
  brand_contact_email: string | null;
  brand_contact_name: string | null;
  stage: DealStage;
  fit_score: number | null;
  estimated_value_cents: number | null;
  actual_value_cents: number | null;
  pitch_text: string | null;
  pitch_sent_at: string | null;
  response_text: string | null;
  responded_at: string | null;
  contract_notes: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface CreateDealInput {
  creator_id: string;
  brand_name: string;
  brand_contact_email?: string | null;
  brand_contact_name?: string | null;
  fit_score?: number | null;
  estimated_value_cents?: number | null;
  actual_value_cents?: number | null;
  pitch_text?: string | null;
  pitch_sent_at?: string | null;
  response_text?: string | null;
  responded_at?: string | null;
  contract_notes?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Idempotent deal creation — prevents duplicates for the same creator + brand.
 *
 * If a non-terminal deal (not completed/lost) already exists for this creator and
 * brand name (case-insensitive), we update it with any richer data provided
 * (higher fit score, better notes, contact info) rather than inserting a duplicate.
 * Terminal deals (completed/lost) are left alone — a new cycle creates a fresh entry.
 */
export async function createDeal(
  dealData: CreateDealInput
): Promise<Deal> {
  const TERMINAL_STAGES = ["completed", "lost"];

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
    if (dealData.fit_score != null && (existing.fit_score == null || dealData.fit_score > existing.fit_score)) {
      updates.fit_score = dealData.fit_score;
    }
    if (dealData.estimated_value_cents != null && (existing.estimated_value_cents == null || dealData.estimated_value_cents > existing.estimated_value_cents)) {
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

    const { data: updated, error: updateError } = await supabase
      .from("deals")
      .update(updates)
      .eq("id", existing.id)
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

export async function updateDealStage(
  dealId: string,
  stage: DealStage,
  extra?: Partial<Deal>
): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .update({ stage, ...extra, updated_at: new Date().toISOString() })
    .eq("id", dealId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getDealsForCreator(
  creatorId: string,
  stage?: DealStage
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

export async function getDealById(dealId: string): Promise<Deal | null> {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
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

export async function getDealByIdForCreator(
  creatorId: string,
  dealId: string
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
