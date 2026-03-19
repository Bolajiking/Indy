import { supabase } from "../client.js";

export interface Creator {
  id: string;
  telegram_chat_id: string | null;
  whatsapp_phone: string | null;
  display_name: string;
  niche: string | null;
  wallet_id: string | null;
  wallet_address: string | null;
  free_credits_remaining_cents: number;
  monthly_spend_cents: number;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export async function findCreatorByTelegram(
  chatId: string
): Promise<Creator | null> {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw error;
  }

  return data;
}

export async function findCreatorByWhatsApp(
  phone: string
): Promise<Creator | null> {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .eq("whatsapp_phone", phone)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    throw error;
  }

  return data;
}

export async function createCreator(
  creatorData: Partial<Creator>
): Promise<Creator> {
  const { data, error } = await supabase
    .from("creators")
    .insert(creatorData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateCreator(
  id: string,
  updates: Partial<Creator>
): Promise<Creator> {
  const { data, error } = await supabase
    .from("creators")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deductCredits(
  creatorId: string,
  amountCents: number
): Promise<Creator> {
  const { data, error } = await supabase.rpc("deduct_credits", {
    creator_id: creatorId,
    amount: amountCents,
  });

  if (error) {
    // Fallback to manual update if RPC doesn't exist
    const creator = await supabase
      .from("creators")
      .select("free_credits_remaining_cents")
      .eq("id", creatorId)
      .single();

    if (creator.error) {
      throw creator.error;
    }

    const newCredits = creator.data.free_credits_remaining_cents - amountCents;

    return updateCreator(creatorId, {
      free_credits_remaining_cents: newCredits,
    });
  }

  return data;
}
