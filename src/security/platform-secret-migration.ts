import { supabase } from "../db/client.js";
import { encryptSecretValue, isEncryptedSecretValue } from "./secrets.js";

interface LegacyPlatformSecretRow {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
}

export interface PlatformSecretMigrationResult {
  scanned: number;
  migrated: number;
  skipped: number;
  dryRun: boolean;
}

function needsEncryption(value: string | null | undefined): boolean {
  return Boolean(value) && !isEncryptedSecretValue(value);
}

export async function migrateLegacyPlatformSecrets(options?: {
  dryRun?: boolean;
}): Promise<PlatformSecretMigrationResult> {
  const dryRun = options?.dryRun ?? false;
  const { data, error } = await supabase
    .from("platform_connections")
    .select("id, access_token, refresh_token");

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as LegacyPlatformSecretRow[];
  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const shouldEncryptAccessToken = needsEncryption(row.access_token);
    const shouldEncryptRefreshToken = needsEncryption(row.refresh_token);

    if (!shouldEncryptAccessToken && !shouldEncryptRefreshToken) {
      skipped += 1;
      continue;
    }

    migrated += 1;

    if (dryRun) {
      continue;
    }

    const updateData: Partial<LegacyPlatformSecretRow> = {};

    if (shouldEncryptAccessToken) {
      updateData.access_token = encryptSecretValue(row.access_token);
    }

    if (shouldEncryptRefreshToken) {
      updateData.refresh_token = encryptSecretValue(row.refresh_token);
    }

    const { error: updateError } = await supabase
      .from("platform_connections")
      .update(updateData)
      .eq("id", row.id);

    if (updateError) {
      throw updateError;
    }
  }

  return {
    scanned: rows.length,
    migrated,
    skipped,
    dryRun,
  };
}
