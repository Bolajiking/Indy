import { getDealsForCreator } from "../db/queries/deals.js";
import { getConnectionsForCreator } from "../db/queries/platform-connections.js";
import { getTransactionsForCreator } from "../db/queries/transactions.js";
import { getConversationHistory } from "../db/queries/messages.js";
import { getCreatorMemories } from "../db/queries/creator-memories.js";
import { getOnChainBalance } from "../wallet/mpp.js";
import { getConnectedAppsForContext } from "../integrations/composio.js";
import { getStoredYoutubeIdentity } from "./connected-identities.js";
import type Anthropic from "@anthropic-ai/sdk";
import type { JsonObject } from "../db/json.js";
import { formatUsd, formatUsdWhole } from "../lib/format.js";
import pino from "#logger";

const log = pino({ name: "agent:memory" });

/**
 * Single, truthful view of everything the creator has connected — merging the
 * native platform connections (platform_connections table) with Composio
 * connected apps — so no agent prompt ever claims an app isn't connected when it
 * is. Deduped by name; Composio links that expired are flagged for reconnect.
 */
export function formatConnectedApps(
  native: Array<{ platform: string; platform_username: string | null }>,
  composio: { connected: string[]; reconnect: string[] },
): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const c of native) {
    seen.add(c.platform.toLowerCase());
    lines.push(`- ${c.platform}: @${c.platform_username ?? ""} (connected)`);
  }
  for (const slug of composio.connected) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    lines.push(`- ${slug} (connected — you can act on it via its tools)`);
  }
  for (const slug of composio.reconnect) {
    if (seen.has(slug)) continue;
    lines.push(
      `- ${slug} (was connected but the link expired — needs reconnect)`,
    );
  }
  return lines.length > 0 ? lines.join("\n") : "- None connected yet";
}

/**
 * Actionable setup gaps so the agent can lead the creator to the next
 * unlocking step instead of refusing when a prerequisite is missing.
 * Returns "" when the account is fully set up.
 */
export function formatSetupGaps(input: {
  nicheSet: boolean;
  hasAnyConnection: boolean;
  reconnect: string[];
  walletCreated: boolean;
  creditsCents: number;
}): string {
  const gaps: string[] = [];
  if (!input.nicheSet) {
    gaps.push(
      "- Niche not set — infer it from the conversation, memories, or connected accounts; if you can't, ask one specific question, then remember the answer.",
    );
  }
  if (!input.hasAnyConnection) {
    gaps.push(
      "- No platforms or apps connected — anything needing their real stats, inbox, or channel works better after a connection; surface request_connections when relevant and still deliver what you can from niche/profile alone.",
    );
  }
  if (input.reconnect.length > 0) {
    gaps.push(
      `- Expired connections: ${input.reconnect.join(", ")} — call request_connections for these before relying on their tools.`,
    );
  }
  if (!input.walletCreated) {
    gaps.push(
      "- Wallet not created yet — paid actions are unavailable; all free actions work.",
    );
  } else if (input.creditsCents <= 0) {
    gaps.push(
      "- Free credits exhausted — paid actions need wallet funding (dashboard → Wallet); all free actions work.",
    );
  }
  if (gaps.length === 0) return "";
  return `\n\n## Setup Gaps (guide the creator — never refuse over these)\n${gaps.join("\n")}`;
}

/**
 * The creator's own YouTube channel, captured at connect time. Surfaced so the
 * agent fetches THEIR stats/videos directly (no need to ask for a handle): pass
 * this channelId to YouTube tools, or `mine: true` for the authenticated channel.
 */
function formatYoutubeIdentity(
  settings: JsonObject | null | undefined,
  youtubeConnected: boolean,
): string {
  const yt = getStoredYoutubeIdentity(settings);
  if (yt) {
    const label = yt.title ?? yt.handle ?? "your channel";
    const handle = yt.handle ? ` (${yt.handle})` : "";
    return `\n- Your YouTube channel: ${label}${handle} — channelId ${yt.channelId}. Use this channelId (or mine:true) for YouTube stats/videos; never ask the creator for their channel.`;
  }
  if (youtubeConnected) {
    return `\n- YouTube is connected to YOUR account — to read the creator's own channel stats/videos, call YouTube tools with mine:true (don't ask them for a handle).`;
  }
  return "";
}

// Stage order for the pipeline summary — mirrors the deal lifecycle.
const STAGE_ORDER = [
  "negotiating",
  "responded",
  "contracted",
  "active",
  "pitched",
  "discovered",
];

interface ContextDeal {
  id: string;
  brand_name: string;
  stage: string;
  estimated_value_cents: number | null;
  notes: string | null;
}

// Cap the resident deal list; the agent can ask for the full pipeline when a
// task actually needs it. Notes ride along only for the highest-value deals.
const MAX_CONTEXT_DEALS = 20;
const NOTED_DEALS = 5;

/**
 * Compressed pipeline view: grouped by stage (action-priority order), sorted by
 * value, notes only on the top deals, sampled past the cap. Keeps every listed
 * deal's ID so stage updates stay possible without a lookup.
 */
export function formatActiveDeals(deals: ContextDeal[]): string {
  if (deals.length === 0) return "- No active deals";

  const ordered = [...deals].sort((a, b) => {
    const stageDiff =
      STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
    if (stageDiff !== 0) return stageDiff;
    return (b.estimated_value_cents ?? 0) - (a.estimated_value_cents ?? 0);
  });

  const shown = ordered.slice(0, MAX_CONTEXT_DEALS);
  const lines = shown.map((d, i) => {
    const note = i < NOTED_DEALS && d.notes ? ` — ${d.notes.slice(0, 80)}` : "";
    return `- [ID: ${d.id}] ${d.brand_name} [${d.stage}] est. ${formatUsdWhole(d.estimated_value_cents ?? 0)}${note}`;
  });
  if (ordered.length > shown.length) {
    lines.push(
      `- …and ${ordered.length - shown.length} more (use deal tools to see the full pipeline)`,
    );
  }
  return lines.join("\n");
}

/**
 * Compressed spending view: identical descriptions grouped with a count and a
 * summed amount, so 10 web searches cost one line instead of ten.
 */
export function formatRecentSpending(
  transactions: Array<{ description: string | null; amount_cents: number }>,
): string {
  if (transactions.length === 0) return "- No spending yet";

  const groups = new Map<string, { count: number; totalCents: number }>();
  for (const t of transactions) {
    const key = t.description ?? "Other";
    const group = groups.get(key) ?? { count: 0, totalCents: 0 };
    group.count += 1;
    group.totalCents += t.amount_cents;
    groups.set(key, group);
  }

  return [...groups.entries()]
    .sort((a, b) => b[1].totalCents - a[1].totalCents)
    .slice(0, 6)
    .map(([description, { count, totalCents }]) =>
      count > 1
        ? `- ${description} ×${count}: ${formatUsd(totalCents)} total`
        : `- ${description}: ${formatUsd(totalCents)}`,
    )
    .join("\n");
}

export async function assembleContext(creatorId: string): Promise<string> {
  const { supabase } = await import("../db/client.js");
  const { data: creator } = await supabase
    .from("creators")
    .select("*")
    .eq("id", creatorId)
    .single();

  if (!creator) return "Unknown creator. Ask them to set up their profile.";

  const [
    deals,
    connections,
    transactions,
    memories,
    onChainBalance,
    connectedApps,
  ] = await Promise.all([
    getDealsForCreator(creatorId),
    getConnectionsForCreator(creatorId),
    getTransactionsForCreator(creatorId, 10),
    getCreatorMemories(creatorId).catch((err) => {
      log.warn({ err, creatorId }, "Failed to load creator memories");
      return [];
    }),
    creator.wallet_address
      ? getOnChainBalance(creator.wallet_address).catch((err) => {
          log.warn(
            { err, creatorId },
            "Failed to load on-chain balance for context",
          );
          return null;
        })
      : Promise.resolve(null),
    getConnectedAppsForContext(creatorId),
  ]);

  const activeDeals = deals.filter((d) =>
    [
      "discovered",
      "pitched",
      "responded",
      "negotiating",
      "contracted",
      "active",
    ].includes(d.stage),
  );

  const now = new Date();
  const dateTimeStr = now.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `
## Current Date & Time
${dateTimeStr}

## Creator Profile
- Name: ${creator.display_name}
- Niche: ${creator.niche ?? "Not set"}
- Wallet: ${creator.wallet_address ? creator.wallet_address : "Not created"}
- On-chain balance: ${onChainBalance ? onChainBalance.balanceFormatted : "Unknown"}
- Free credits remaining: ${formatUsd(creator.free_credits_remaining_cents)}

## What I Remember About You
${
  memories.length > 0
    ? memories
        .slice(0, 12)
        .map((m) => `- ${m.content}`)
        .join("\n")
    : "- Nothing saved yet — learn from what they tell you"
}

## Connected Apps & Platforms
${formatConnectedApps(connections, connectedApps)}${formatYoutubeIdentity(creator.settings, connectedApps.connected.includes("youtube"))}${formatSetupGaps(
    {
      nicheSet: Boolean(creator.niche),
      hasAnyConnection:
        connections.length > 0 || connectedApps.connected.length > 0,
      reconnect: connectedApps.reconnect,
      walletCreated: Boolean(creator.wallet_address),
      creditsCents: creator.free_credits_remaining_cents ?? 0,
    },
  )}

## Active Deals (${activeDeals.length})
${formatActiveDeals(activeDeals)}

## Recent Agent Spending
${formatRecentSpending(transactions.slice(0, 10))}
`.trim();
}

/**
 * Build the LLM message array: creator context is attached to the earliest
 * user message, recent history is replayed with alternating roles, and the
 * current message lands as (or merges into) the final user turn.
 */
export function buildConversationMessages(
  context: string,
  recentMessages: Array<{ role: string; content: string }>,
  userMessage: string,
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  if (recentMessages.length === 0) {
    return [
      {
        role: "user",
        content: `<creator_context>\n${context}\n</creator_context>\n\n${userMessage}`,
      },
    ];
  }

  messages.push({
    role: "user",
    content: `<creator_context>\n${context}\n</creator_context>\n\n${recentMessages[0].content}`,
  });
  for (let i = 1; i < recentMessages.length; i++) {
    const msg = recentMessages[i];
    const lastRole = messages[messages.length - 1].role;
    if (msg.role === lastRole) continue;
    messages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }
  const last = messages[messages.length - 1];
  if (last.role === "user") {
    messages[messages.length - 1] = {
      role: "user",
      content: `${last.content}\n\n${userMessage}`,
    };
  } else {
    messages.push({ role: "user", content: userMessage });
  }
  return messages;
}

export async function getRecentMessages(
  creatorId: string,
): Promise<Array<{ role: string; content: string }>> {
  try {
    const messages = await getConversationHistory(creatorId, 20);
    return messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
  } catch (err) {
    log.warn({ err, creatorId }, "Failed to load recent messages");
    return [];
  }
}
