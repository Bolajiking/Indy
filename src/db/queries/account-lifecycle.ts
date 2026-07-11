import { createHash, randomBytes } from "node:crypto";
import { supabase } from "../client.js";

export type AccountDeletionState =
  | "requested"
  | "revoking-connections"
  | "deleting"
  | "completed"
  | "retryable-failure";

export interface AccountDeletionResidual {
  kind: "agent-wallet" | "on-chain-address" | "archived-embedded-wallet";
  identifier?: string;
  detail: string;
}

export interface AccountDeletionRecord {
  creatorId?: string;
  state: AccountDeletionState;
  residuals: AccountDeletionResidual[];
  error?: string | null;
}

export interface AccountDeletionReceipt extends AccountDeletionRecord {
  receiptToken: string;
  receiptExpiresAt: string;
}

const RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;
const SECRET_KEY =
  /(access.?token|refresh.?token|private.?key|secret|password|authorization|cookie|credential|wallet.?id|signing)/i;

export function hashDeletionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isDeletionTokenExpired(
  expiresAt: string,
  now = Date.now(),
): boolean {
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
}

export function redactExportSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactExportSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, entry]) => [key, redactExportSecrets(entry)]),
  );
}

async function rows(table: string, creatorId: string, columns: string) {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("creator_id", creatorId);
  if (error) throw error;
  return (data ?? []) as unknown as Array<Record<string, unknown>>;
}

export async function buildCreatorExport(creatorId: string) {
  const { data: creator, error } = await supabase
    .from("creators")
    .select(
      "id, display_name, niche, wallet_address, telegram_chat_id, whatsapp_phone, account_status, created_at, updated_at",
    )
    .eq("id", creatorId)
    .single();
  if (error) throw error;

  const [
    deals,
    transactions,
    paymentAttempts,
    messages,
    actions,
    memories,
    outcomes,
    connections,
  ] = await Promise.all([
    rows(
      "deals",
      creatorId,
      "id, creator_id, brand_name, brand_contact_email, brand_contact_name, brand_domain, stage, fit_score, estimated_value_cents, actual_value_cents, source_url, source_type, source_confidence, source_evidence, deliverables, deadline_at, follow_up_at, probability, next_action, agent_provenance, archived_at, pitch_text, pitch_sent_at, response_text, responded_at, contract_notes, notes, metadata, created_at, updated_at",
    ),
    rows(
      "transactions",
      creatorId,
      "id, creator_id, type, amount_cents, currency, description, service, tx_hash, metadata, created_at",
    ),
    rows(
      "payment_attempts",
      creatorId,
      "id, creator_id, transaction_id, service_url, service_host, method, intent, currency, quoted_amount_cents, actual_amount_cents, status, challenge_id, receipt_reference, tx_hash, error, metadata, created_at, updated_at",
    ),
    rows(
      "messages",
      creatorId,
      "id, creator_id, role, content, metadata, created_at",
    ),
    rows(
      "agent_actions",
      creatorId,
      "id, creator_id, action_type, status, description, input, output, cost_cents, requires_approval, approved_at, executed_at, expires_at, created_at",
    ),
    rows(
      "creator_memories",
      creatorId,
      "id, creator_id, memory_type, skill, key, content, confidence, times_reinforced, last_used_at, created_at, updated_at",
    ),
    rows(
      "skill_outcomes",
      creatorId,
      "id, creator_id, skill, action_id, input_summary, output_summary, success, creator_feedback, creator_rating, learnings, created_at",
    ),
    rows(
      "platform_connections",
      creatorId,
      "id, creator_id, platform, platform_user_id, platform_username, expires_at, created_at",
    ),
  ]);

  return redactExportSecrets({
    exportedAt: new Date().toISOString(),
    creator,
    deals,
    transactions,
    paymentAttempts,
    messages,
    actions,
    memories,
    outcomes,
    connections: connections.map((connection) => ({
      ...connection,
      connected: true,
    })),
  });
}

function hydrateLifecycle(
  data: Record<string, unknown>,
  includeCreator = true,
): AccountDeletionRecord {
  return {
    ...(includeCreator ? { creatorId: String(data.creator_id) } : {}),
    state: data.state as AccountDeletionState,
    residuals: Array.isArray(data.residuals)
      ? (data.residuals as AccountDeletionResidual[])
      : [],
    error: typeof data.error === "string" ? data.error : null,
  };
}

export async function getAccountDeletion(
  creatorId: string,
): Promise<AccountDeletionRecord | null> {
  const { data, error } = await supabase
    .from("account_deletions")
    .select("creator_id, state, residuals, error")
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (error) throw error;
  return data ? hydrateLifecycle(data as Record<string, unknown>) : null;
}

export async function getAccountDeletionByToken(
  receiptToken: string,
): Promise<AccountDeletionRecord | null> {
  const { data, error } = await supabase
    .from("account_deletions")
    .select("creator_id, state, residuals, error, status_token_expires_at")
    .eq("status_token_hash", hashDeletionToken(receiptToken))
    .maybeSingle();
  if (error) throw error;
  if (!data || isDeletionTokenExpired(String(data.status_token_expires_at))) {
    return null;
  }
  return hydrateLifecycle(data as Record<string, unknown>, false);
}

export async function getAccountDeletionOwnerByToken(
  receiptToken: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("account_deletions")
    .select("creator_id, status_token_expires_at")
    .eq("status_token_hash", hashDeletionToken(receiptToken))
    .maybeSingle();
  if (error) throw error;
  if (!data || isDeletionTokenExpired(String(data.status_token_expires_at))) {
    return null;
  }
  return String(data.creator_id);
}

export async function requestAccountDeletion(
  creatorId: string,
): Promise<AccountDeletionReceipt> {
  const existing = await getAccountDeletion(creatorId);
  let creator: Record<string, unknown> | null = null;
  if (!existing) {
    const result = await supabase
      .from("creators")
      .select("id, privy_user_id, wallet_id, wallet_address")
      .eq("id", creatorId)
      .single();
    if (result.error) throw result.error;
    creator = result.data as Record<string, unknown>;
  }

  const receiptToken = randomBytes(32).toString("base64url");
  const receiptExpiresAt = new Date(Date.now() + RECEIPT_TTL_MS).toISOString();
  const nextState =
    existing?.state === "retryable-failure"
      ? "requested"
      : (existing?.state ?? "requested");
  const { data, error } = await supabase
    .from("account_deletions")
    .upsert(
      {
        creator_id: creatorId,
        ...(creator
          ? {
              privy_user_id: creator.privy_user_id,
              agent_wallet_id: creator.wallet_id,
              wallet_address: creator.wallet_address,
            }
          : {}),
        state: nextState,
        error: null,
        status_token_hash: hashDeletionToken(receiptToken),
        status_token_expires_at: receiptExpiresAt,
        requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "creator_id" },
    )
    .select("creator_id, state, residuals, error")
    .single();
  if (error) throw error;

  const { error: updateError } = await supabase
    .from("creators")
    .update({
      account_status: "pending_deletion",
      deletion_requested_at: new Date().toISOString(),
    })
    .eq("id", creatorId);
  if (updateError) throw updateError;
  return {
    ...hydrateLifecycle(data as Record<string, unknown>),
    receiptToken,
    receiptExpiresAt,
  };
}

export async function updateAccountDeletion(
  creatorId: string,
  state: AccountDeletionState,
  details: {
    residuals?: AccountDeletionResidual[];
    error?: string | null;
  } = {},
): Promise<void> {
  const update = {
    state,
    updated_at: new Date().toISOString(),
    ...(details.residuals ? { residuals: details.residuals } : {}),
    ...(details.error !== undefined ? { error: details.error } : {}),
    ...(state === "completed"
      ? {
          completed_at: new Date().toISOString(),
          privy_user_id: null,
          agent_wallet_id: null,
        }
      : {}),
  };
  const { error } = await supabase
    .from("account_deletions")
    .update(update)
    .eq("creator_id", creatorId);
  if (error) throw error;
}

export async function getDeletionCreatorSnapshot(creatorId: string) {
  const { data, error } = await supabase
    .from("account_deletions")
    .select("creator_id, privy_user_id, agent_wallet_id, wallet_address")
    .eq("creator_id", creatorId)
    .single();
  if (error) throw error;
  return {
    id: String(data.creator_id),
    privy_user_id: data.privy_user_id as string | null,
    wallet_id: data.agent_wallet_id as string | null,
    wallet_address: data.wallet_address as string | null,
  };
}

export async function deleteNativeConnections(creatorId: string) {
  const { error } = await supabase
    .from("platform_connections")
    .delete()
    .eq("creator_id", creatorId);
  if (error) throw error;
}

export async function deleteCreatorLast(creatorId: string) {
  const { error } = await supabase
    .from("creators")
    .delete()
    .eq("id", creatorId);
  if (error) throw error;
}
