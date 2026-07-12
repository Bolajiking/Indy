import { supabase } from "../db/client.js";
import {
  decryptStoredSecretValue,
  encryptSecretValue,
  getCurrentPlatformKeyVersion,
  getEncryptedSecretKeyVersion,
} from "./secrets.js";

interface PlatformSecretRow {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  key_version: number;
}

export interface PlatformSecretMigrationResult {
  scanned: number;
  rotated: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  nextCursor: string | null;
  complete: boolean;
}

export interface PlatformSecretMigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
  afterId?: string;
}

function needsRotation(
  row: PlatformSecretRow,
  currentVersion: number,
): boolean {
  if (row.key_version !== currentVersion) return true;
  return [row.access_token, row.refresh_token].some((token) => {
    if (!token) return false;
    return getEncryptedSecretKeyVersion(token) !== currentVersion;
  });
}

export async function migrateLegacyPlatformSecrets(
  options: PlatformSecretMigrationOptions = {},
): Promise<PlatformSecretMigrationResult> {
  const dryRun = options.dryRun ?? false;
  const batchSize = options.batchSize ?? 100;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error(
      "Platform secret migration batch size must be between 1 and 500",
    );
  }

  let query = supabase
    .from("platform_connections")
    .select("id, access_token, refresh_token, key_version");
  if (options.afterId) query = query.gt("id", options.afterId);
  const { data, error } = await query
    .order("id", { ascending: true })
    .limit(batchSize);
  if (error) throw error;

  const rows = (data ?? []) as PlatformSecretRow[];
  const currentVersion = getCurrentPlatformKeyVersion();
  let rotated = 0;
  let skipped = 0;
  let failed = 0;
  let firstFailedIndex: number | null = null;

  for (const [index, row] of rows.entries()) {
    try {
      if (!needsRotation(row, currentVersion)) {
        // Treat authentication failure/corruption as a failed row, not as an
        // already-current credential that silently escapes the rotation audit.
        decryptStoredSecretValue(row.access_token, row.key_version);
        decryptStoredSecretValue(row.refresh_token, row.key_version);
        skipped += 1;
        continue;
      }
      const accessToken = decryptStoredSecretValue(
        row.access_token,
        row.key_version,
      );
      const refreshToken = decryptStoredSecretValue(
        row.refresh_token,
        row.key_version,
      );
      if (!dryRun) {
        let updateQuery = supabase
          .from("platform_connections")
          .update({
            access_token: encryptSecretValue(accessToken),
            refresh_token: encryptSecretValue(refreshToken),
            key_version: currentVersion,
          })
          .eq("id", row.id)
          .eq("key_version", row.key_version);
        updateQuery =
          row.access_token === null
            ? updateQuery.is("access_token", null)
            : updateQuery.eq("access_token", row.access_token);
        updateQuery =
          row.refresh_token === null
            ? updateQuery.is("refresh_token", null)
            : updateQuery.eq("refresh_token", row.refresh_token);
        const { data: updatedRows, error: updateError } =
          await updateQuery.select("id");
        if (updateError) throw updateError;
        if (!updatedRows || updatedRows.length !== 1) {
          throw new Error("Platform credential changed during rotation");
        }
      }
      rotated += 1;
    } catch {
      failed += 1;
      firstFailedIndex ??= index;
    }
  }

  const complete = failed === 0 && rows.length < batchSize;
  const retryCursor =
    firstFailedIndex === null
      ? null
      : firstFailedIndex === 0
        ? (options.afterId ?? null)
        : rows[firstFailedIndex - 1].id;
  return {
    scanned: rows.length,
    rotated,
    skipped,
    failed,
    dryRun,
    nextCursor: complete
      ? null
      : failed > 0
        ? retryCursor
        : (rows.at(-1)?.id ?? options.afterId ?? null),
    complete,
  };
}
