import { supabase } from "../client.js";

export interface PlatformConnection {
  id: string;
  creator_id: string;
  platform: string;
  access_token: string;
  refresh_token: string | null;
  platform_user_id: string | null;
  platform_username: string | null;
  metadata: Record<string, any>;
  expires_at: string | null;
  created_at: string;
}

export async function upsertConnection(
  connectionData: Omit<PlatformConnection, "id" | "created_at">
): Promise<PlatformConnection> {
  const { data, error } = await supabase
    .from("platform_connections")
    .upsert(connectionData, {
      onConflict: "creator_id,platform",
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getConnectionsForCreator(
  creatorId: string
): Promise<PlatformConnection[]> {
  const { data, error } = await supabase
    .from("platform_connections")
    .select("*")
    .eq("creator_id", creatorId);

  if (error) {
    throw error;
  }

  return data;
}

export async function getConnection(
  creatorId: string,
  platform: string
): Promise<PlatformConnection | null> {
  const { data, error } = await supabase
    .from("platform_connections")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("platform", platform)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw error;
  }

  return data;
}
