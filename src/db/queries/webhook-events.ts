import { supabase } from "../client.js";

export type WebhookProvider = "telegram" | "whatsapp";
export type WebhookEventStatus =
  | "queued"
  | "processing"
  | "processed"
  | "failed"
  | "outcome_unknown";

export interface ClaimWebhookEventInput {
  provider: WebhookProvider;
  providerEventId: string;
  payloadHash: string;
}

export interface WebhookEventClaim {
  claimed: boolean;
  status: WebhookEventStatus;
}

export interface WebhookDeliveryLeaseInput {
  provider: WebhookProvider;
  providerEventId: string;
  attemptCount: number;
  leaseToken: string;
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

/**
 * Atomically acquires the one durable delivery lease for a queued receipt.
 *
 * Leases deliberately do not expire automatically. After an external side
 * effect starts, a process crash cannot tell whether that effect completed;
 * replaying it would be less safe than flagging it for reconciliation.
 */
export async function acquireWebhookDelivery(
  input: WebhookDeliveryLeaseInput,
  client: SupabaseClient = supabase,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("webhook_events")
    .update({
      status: "processing",
      attempt_count: input.attemptCount,
      delivery_lease_token: input.leaseToken,
      delivery_started_at: now,
      delivery_outcome: "pending",
      error: null,
      updated_at: now,
    })
    .eq("provider", input.provider)
    .eq("provider_event_id", input.providerEventId)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();
  if (error) throw error;

  return data !== null;
}

export async function markWebhookProcessed(
  provider: WebhookProvider,
  providerEventId: string,
  leaseToken?: string,
  client: SupabaseClient = supabase,
): Promise<void> {
  const now = new Date().toISOString();
  let query = client
    .from("webhook_events")
    .update({
      status: "processed",
      delivery_outcome: "confirmed",
      error: null,
      processed_at: now,
      updated_at: now,
    })
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId);
  if (leaseToken) {
    query = query.eq("delivery_lease_token", leaseToken);
  }
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Webhook delivery lease was not held");
}

export async function markWebhookOutcomeUnknown(
  provider: WebhookProvider,
  providerEventId: string,
  leaseToken: string,
  redactedError: string,
  client: SupabaseClient = supabase,
): Promise<void> {
  const { data, error } = await client
    .from("webhook_events")
    .update({
      status: "outcome_unknown",
      delivery_outcome: "unknown",
      error: redactedError,
      updated_at: new Date().toISOString(),
    })
    .eq("provider", provider)
    .eq("provider_event_id", providerEventId)
    .eq("delivery_lease_token", leaseToken)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Webhook delivery lease was not held");
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
