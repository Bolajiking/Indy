import { supabase } from "../client.js";
import type { JsonObject } from "../json.js";
import type { PaymentAttemptStatus } from "../../wallet/payment-attempt-status.js";

export interface PaymentAttempt {
  id: string;
  creator_id: string;
  transaction_id: string | null;
  service_url: string;
  service_host: string;
  method: string | null;
  intent: string | null;
  currency: string | null;
  quoted_amount_cents: number | null;
  actual_amount_cents: number | null;
  status: PaymentAttemptStatus;
  challenge_id: string | null;
  receipt_reference: string | null;
  tx_hash: string | null;
  error: string | null;
  metadata: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentAttemptInput {
  creator_id: string;
  service_url: string;
  service_host: string;
  status: PaymentAttemptStatus;
  transaction_id?: string | null;
  method?: string | null;
  intent?: string | null;
  currency?: string | null;
  quoted_amount_cents?: number | null;
  actual_amount_cents?: number | null;
  challenge_id?: string | null;
  receipt_reference?: string | null;
  tx_hash?: string | null;
  error?: string | null;
  metadata?: JsonObject;
}

export type UpdatePaymentAttemptInput = Partial<
  Omit<CreatePaymentAttemptInput, "creator_id" | "service_url" | "service_host">
>;

export async function createPaymentAttempt(
  attemptData: CreatePaymentAttemptInput,
): Promise<PaymentAttempt> {
  const payload = {
    ...attemptData,
    metadata: attemptData.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("payment_attempts")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePaymentAttempt(
  attemptId: string,
  updates: UpdatePaymentAttemptInput,
): Promise<PaymentAttempt> {
  const { data, error } = await supabase
    .from("payment_attempts")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getPaymentAttemptsForCreator(
  creatorId: string,
  limit: number = 50,
): Promise<PaymentAttempt[]> {
  const { data, error } = await supabase
    .from("payment_attempts")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}
