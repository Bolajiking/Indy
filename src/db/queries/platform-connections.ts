import { supabase } from "../client.js";
import {
  decryptSecretValue,
  encryptSecretValue,
  getCurrentPlatformKeyVersion,
  getEncryptedSecretKeyVersion,
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
  key_version: number;
  created_at: string;
}

function hydrateSecrets(connection: PlatformConnection): PlatformConnection {
  for (const token of [connection.access_token, connection.refresh_token]) {
    const envelopeVersion = getEncryptedSecretKeyVersion(token);
    if (
      envelopeVersion !== null &&
      envelopeVersion !== connection.key_version
    ) {
      throw new Error("Platform credential key version mismatch");
    }
  }
  return {
    ...connection,
    access_token: decryptSecretValue(connection.access_token) ?? "",
    refresh_token: decryptSecretValue(connection.refresh_token),
  };
}

export async function upsertConnection(
  connectionData: Omit<PlatformConnection, "id" | "created_at" | "key_version">,
): Promise<PlatformConnection> {
  const encryptedConnectionData = {
    ...connectionData,
    access_token: encryptSecretValue(connectionData.access_token) ?? "",
    refresh_token: encryptSecretValue(connectionData.refresh_token),
    key_version: getCurrentPlatformKeyVersion(),
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
