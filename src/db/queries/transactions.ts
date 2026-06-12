import { supabase } from "../client.js";
import type { JsonObject } from "../json.js";

export interface Transaction {
  id: string;
  creator_id: string;
  type: string;
  amount_cents: number;
  currency: string;
  description: string;
  service: string | null;
  tx_hash: string | null;
  metadata: JsonObject;
  created_at: string;
}

export interface LogTransactionInput {
  creator_id: string;
  type: string;
  amount_cents: number;
  description: string;
  currency?: string;
  service?: string | null;
  tx_hash?: string | null;
  metadata?: JsonObject;
}

export async function logTransaction(
  transactionData: LogTransactionInput,
): Promise<Transaction> {
  const payload = {
    currency: "USD",
    ...transactionData,
    metadata: transactionData.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("transactions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getTransactionsForCreator(
  creatorId: string,
  limit: number = 50,
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getTotalSpendToday(creatorId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return getTotalSpendSince(creatorId, today);
}

export async function getTotalSpendThisMonth(
  creatorId: string,
): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  return getTotalSpendSince(creatorId, monthStart);
}

async function getTotalSpendSince(
  creatorId: string,
  since: Date,
): Promise<number> {
  // Spend = outgoing only. Credit top-ups / refunds must not offset or inflate
  // the daily/monthly totals that spending limits are checked against.
  const { data, error } = await supabase
    .from("transactions")
    .select("amount_cents")
    .eq("creator_id", creatorId)
    .neq("type", "credit")
    .gte("created_at", since.toISOString());

  if (error) {
    throw error;
  }

  return (data ?? []).reduce(
    (sum, tx) => sum + Math.max(0, tx.amount_cents),
    0,
  );
}
