import { supabase } from "../client.js";

export interface Transaction {
  id: string;
  creator_id: string;
  type: string;
  amount_cents: number;
  currency: string;
  description: string;
  service: string | null;
  tx_hash: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export async function logTransaction(
  transactionData: Omit<Transaction, "id" | "created_at" | "currency"> & {
    currency?: string;
  }
): Promise<Transaction> {
  const { data, error } = await supabase
    .from("transactions")
    .insert({ currency: "USD", ...transactionData })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getTransactionsForCreator(
  creatorId: string
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function getTotalSpendToday(creatorId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("transactions")
    .select("amount_cents")
    .eq("creator_id", creatorId)
    .gte("created_at", today.toISOString());

  if (error) {
    throw error;
  }

  return data.reduce((sum, tx) => sum + tx.amount_cents, 0);
}
