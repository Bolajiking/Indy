import { getDealsForCreator } from "../db/queries/deals.js";
import { getConnectionsForCreator } from "../db/queries/platform-connections.js";
import { getTransactionsForCreator } from "../db/queries/transactions.js";

export async function assembleContext(creatorId: string): Promise<string> {
  const { supabase } = await import("../db/client.js");
  const { data: creator } = await supabase
    .from("creators")
    .select("*")
    .eq("id", creatorId)
    .single();

  if (!creator) return "Unknown creator. Ask them to set up their profile.";

  const deals = await getDealsForCreator(creatorId);
  const connections = await getConnectionsForCreator(creatorId);
  const transactions = await getTransactionsForCreator(creatorId, 10);

  const activeDeals = deals.filter((d) =>
    ["discovered", "pitched", "responded", "negotiating", "contracted", "active"].includes(d.stage)
  );

  return `
## Creator Profile
- Name: ${creator.display_name}
- Niche: ${creator.niche ?? "Not set"}
- Wallet: ${creator.wallet_address ? `${creator.wallet_address.slice(0, 8)}...` : "Not created"}
- Free credits remaining: $${(creator.free_credits_remaining_cents / 100).toFixed(2)}

## Connected Platforms
${connections.length > 0 ? connections.map((c: any) => `- ${c.platform}: @${c.platform_username}`).join("\n") : "- None connected yet"}

## Active Deals (${activeDeals.length})
${activeDeals.length > 0 ? activeDeals.map((d) => `- ${d.brand_name} [${d.stage}] est. $${((d.estimated_value_cents ?? 0) / 100).toFixed(0)}`).join("\n") : "- No active deals"}

## Recent Agent Spending
${transactions.length > 0 ? transactions.slice(0, 5).map((t) => `- ${t.description}: $${(t.amount_cents / 100).toFixed(2)}`).join("\n") : "- No spending yet"}
`.trim();
}
