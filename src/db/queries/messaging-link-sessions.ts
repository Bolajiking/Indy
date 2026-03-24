import type { MessagingPlatform } from "../../messaging/link-tokens.js";
import { supabase } from "../client.js";

export interface MessagingLinkSessionRow {
  id: string;
  creator_id: string;
  platform: MessagingPlatform;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_by_platform_user_id: string | null;
  created_at: string;
}

export async function createMessagingLinkSession(input: {
  id: string;
  creatorId: string;
  platform: MessagingPlatform;
  tokenHash: string;
  expiresAt: string;
}): Promise<MessagingLinkSessionRow> {
  const { data, error } = await supabase
    .from("messaging_link_sessions")
    .insert({
      id: input.id,
      creator_id: input.creatorId,
      platform: input.platform,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function consumeMessagingLinkSession(
  id: string,
  platform: MessagingPlatform,
  tokenHash: string,
  platformUserId: string
): Promise<MessagingLinkSessionRow | null> {
  const { data, error } = await supabase
    .from("messaging_link_sessions")
    .update({
      consumed_at: new Date().toISOString(),
      consumed_by_platform_user_id: platformUserId,
    })
    .eq("id", id)
    .eq("platform", platform)
    .eq("token_hash", tokenHash)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw error;
  }

  return data;
}
