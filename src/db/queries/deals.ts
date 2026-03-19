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

export async function createDeal(
  dealData: Partial<Deal> & { creator_id: string; brand_name: string }
): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .insert({ stage: "discovered", ...dealData })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateDealStage(
  dealId: string,
  stage: DealStage
): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("id", dealId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getDealsForCreator(creatorId: string): Promise<Deal[]> {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
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
