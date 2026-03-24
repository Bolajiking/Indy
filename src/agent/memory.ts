import { getDealsForCreator } from "../db/queries/deals.js";
import { getConnectionsForCreator } from "../db/queries/platform-connections.js";
import { getTransactionsForCreator } from "../db/queries/transactions.js";
import { getConversationHistory } from "../db/queries/messages.js";
import { getOnChainBalance } from "../wallet/mpp.js";

export async function assembleContext(creatorId: string): Promise<string> {
  const { supabase } = await import("../db/client.js");
  const { data: creator } = await supabase
    .from("creators")
    .select("*")
    .eq("id", creatorId)
    .single();

  if (!creator) return "Unknown creator. Ask them to set up their profile.";

  const [deals, connections, transactions, onChainBalance] = await Promise.all([
    getDealsForCreator(creatorId),
    getConnectionsForCreator(creatorId),
    getTransactionsForCreator(creatorId, 10),
    creator.wallet_address
      ? getOnChainBalance(creator.wallet_address).catch(() => null)
      : Promise.resolve(null),
  ]);

  const activeDeals = deals.filter((d) =>
    ["discovered", "pitched", "responded", "negotiating", "contracted", "active"].includes(d.stage)
  );

  const now = new Date();
  const dateTimeStr = now.toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  return `
## Current Date & Time
${dateTimeStr}

## Creator Profile
- Name: ${creator.display_name}
- Niche: ${creator.niche ?? "Not set"}
- Wallet: ${creator.wallet_address ? creator.wallet_address : "Not created"}
- On-chain balance: ${onChainBalance ? onChainBalance.balanceFormatted : "Unknown"}
- Free credits remaining: $${(creator.free_credits_remaining_cents / 100).toFixed(2)}

## Connected Platforms
${connections.length > 0 ? connections.map((c: any) => `- ${c.platform}: @${c.platform_username}`).join("\n") : "- None connected yet"}

## Active Deals (${activeDeals.length})
${activeDeals.length > 0 ? activeDeals.map((d) => `- ${d.brand_name} [${d.stage}] est. $${((d.estimated_value_cents ?? 0) / 100).toFixed(0)}`).join("\n") : "- No active deals"}

## Recent Agent Spending
${transactions.length > 0 ? transactions.slice(0, 5).map((t) => `- ${t.description}: $${(t.amount_cents / 100).toFixed(2)}`).join("\n") : "- No spending yet"}
`.trim();
}

export async function getRecentMessages(creatorId: string): Promise<Array<{ role: string; content: string }>> {
  try {
    const messages = await getConversationHistory(creatorId, 20);
    return messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
  } catch {
    return [];
  }
}
