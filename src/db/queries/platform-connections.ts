import { supabase } from "../client.js";
import {
  decryptSecretValue,
  encryptSecretValue,
} from "../../security/secrets.js";
import type { JsonObject } from "../json.js";

export interface PlatformConnection {
  id: string;
  creator_id: string;
  platform: string;
  access_token: string;
  refresh_token: string | null;
  platform_user_id: string | null;
  platform_username: string | null;
  metadata: JsonObject;
  expires_at: string | null;
  created_at: string;
}

function hydrateSecrets(connection: PlatformConnection): PlatformConnection {
  return {
    ...connection,
    access_token: decryptSecretValue(connection.access_token) ?? "",
    refresh_token: decryptSecretValue(connection.refresh_token),
  };
}

export async function upsertConnection(
  connectionData: Omit<PlatformConnection, "id" | "created_at">,
): Promise<PlatformConnection> {
  const encryptedConnectionData = {
    ...connectionData,
    access_token: encryptSecretValue(connectionData.access_token) ?? "",
    refresh_token: encryptSecretValue(connectionData.refresh_token),
  };

  const { data, error } = await supabase
    .from("platform_connections")
    .upsert(encryptedConnectionData, {
      onConflict: "creator_id,platform",
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return hydrateSecrets(data);
}

export async function getConnectionsForCreator(
  creatorId: string,
): Promise<PlatformConnection[]> {
  const { data, error } = await supabase
    .from("platform_connections")
    .select("*")
    .eq("creator_id", creatorId);

  if (error) {
    throw error;
  }

  return data.map(hydrateSecrets);
}

export async function getConnection(
  creatorId: string,
  platform: string,
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

  return hydrateSecrets(data);
}

export async function deleteConnectionById(id: string): Promise<void> {
  const { error } = await supabase
    .from("platform_connections")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }
}
