import { supabase } from "../client.js";
import type { JsonObject } from "../json.js";

export interface Message {
  id: string;
  creator_id: string;
  role: string;
  content: string;
  metadata: JsonObject;
  created_at: string;
}

export async function saveMessage(
  messageData: Omit<Message, "id" | "created_at">,
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert(messageData)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getConversationHistory(
  creatorId: string,
  limit: number = 50,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  // Return in chronological order (oldest first)
  return data.reverse();
}
