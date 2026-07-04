import { supabase } from "../client.js";

export type WebhookProvider = "telegram" | "whatsapp";
export type WebhookEventStatus =
  | "queued"
  | "processing"
  | "processed"
  | "failed";

export interface ClaimWebhookEventInput {
  provider: WebhookProvider;
  providerEventId: string;
  payloadHash: string;
}

export interface WebhookEventClaim {
  claimed: boolean;
  status: WebhookEventStatus;
}

type SupabaseClient = typeof supabase;

export async function claimWebhookEvent(
  input: ClaimWebhookEventInput,
  client: SupabaseClient = supabase,
): Promise<WebhookEventClaim> {
  const { data, error } = await client
    .from("webhook_events")
    .insert({
      provider: input.provider,
      provider_event_id: input.providerEventId,
      payload_hash: input.payloadHash,
      status: "queued",
    })
    .select("status")
    .single();

  if (!error) {
    return { claimed: true, status: data.status as WebhookEventStatus };
  }

  if (error.code !== "23505") throw error;

  const existing = await client
    .from("webhook_events")
    .select("status")
    .eq("provider", input.provider)
    .eq("provider_event_id", input.providerEventId)
    .single();
  if (existing.error) throw existing.error;

  return {
    claimed: false,
    status: existing.data.status as WebhookEventStatus,
  };
}

export async function markWebhookAttempt(
  provider: WebhookProvider,
  providerEventId: string,
  attemptCount: number,
  client: SupabaseClient = supabase,
): Promise<void> {
  const { error } = await client
    .from("webhook_events")
    .update({
      status: "processing",
      attempt_count: attemptCount,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId);
  if (error) throw error;
}

export async function markWebhookProcessed(
  provider: WebhookProvider,
  providerEventId: string,
  client: SupabaseClient = supabase,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await client
    .from("webhook_events")
    .update({
      status: "processed",
      error: null,
      processed_at: now,
      updated_at: now,
    })
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId);
  if (error) throw error;
}

export async function markWebhookFailed(
  provider: WebhookProvider,
  providerEventId: string,
  attemptCount: number,
  redactedError: string,
  client: SupabaseClient = supabase,
): Promise<void> {
  const { error } = await client
    .from("webhook_events")
    .update({
      status: "failed",
      attempt_count: attemptCount,
      error: redactedError,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId);
  if (error) throw error;
}
