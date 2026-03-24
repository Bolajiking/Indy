import pino from "pino";
import { AGENT } from "../config/constants.js";
import { getDealsForCreator } from "../db/queries/deals.js";
import { getTransactionsForCreator } from "../db/queries/transactions.js";
import {
  getCreatorById,
  listCreatorsForMorningBriefs,
} from "../db/queries/creators.js";
import anthropic from "../agent/anthropic.js";
import { sendMessageToCreator } from "../bot/telegram.js";
import { sendWhatsAppMessage } from "../bot/whatsapp.js";

const log = pino({ name: "jobs:eod-summary" });

export async function runEndOfDaySummary(creatorId?: string): Promise<void> {
  if (creatorId) {
    await summarySingleCreator(creatorId);
    return;
  }

  const creators = await listCreatorsForMorningBriefs();
  for (const creator of creators) {
    try {
      await summarySingleCreator(creator.id);
    } catch (error) {
      log.error({ creatorId: creator.id, error }, "EOD summary failed");
    }
  }
}

async function summarySingleCreator(creatorId: string): Promise<void> {
  const creator = await getCreatorById(creatorId);
  if (!creator) return;

  const [deals, transactions] = await Promise.all([
    getDealsForCreator(creatorId),
    getTransactionsForCreator(creatorId),
  ]);

  // Filter to today's activity
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = todayStart.getTime();

  const todayDeals = deals.filter(
    (d) => new Date(d.updated_at).getTime() >= todayTs
  );
  const todayTx = transactions.filter(
    (t) => new Date(t.created_at).getTime() >= todayTs
  );

  if (todayDeals.length === 0 && todayTx.length === 0) {
    log.info({ creatorId }, "No activity today — skipping EOD summary");
    return;
  }

  const response = await anthropic.messages.create({
    model: AGENT.FAST_LLM,
    max_tokens: 1024,
    system: `You are Indyfren, a creator's AI business manager. Generate a brief end-of-day summary. Keep it under 200 words. Use Markdown. Include:
- Deals that moved today
- Any payments/transactions
- Quick wins or concerns
- One action item for tomorrow`,
    messages: [
      {
        role: "user",
        content: `Deals updated today (${todayDeals.length}):\n${JSON.stringify(
          todayDeals.map((d) => ({
            brand: d.brand_name,
            stage: d.stage,
            value: d.estimated_value_cents,
          }))
        )}\n\nTransactions today (${todayTx.length}):\n${JSON.stringify(
          todayTx.map((t) => ({
            type: t.type,
            amount: t.amount_cents,
            description: t.description,
          }))
        )}`,
      },
    ],
  });

  const text =
    response.content.find((b) => b.type === "text")?.text ??
    "No summary generated.";

  const outgoing = { text: `*End-of-Day Summary*\n\n${text}`, parseMode: "Markdown" as const };

  if (creator.telegram_chat_id) {
    await sendMessageToCreator(creator.telegram_chat_id, outgoing);
    log.info({ creatorId, platform: "telegram" }, "EOD summary sent");
  }

  if (creator.whatsapp_phone) {
    await sendWhatsAppMessage(creator.whatsapp_phone, outgoing);
    log.info({ creatorId, platform: "whatsapp" }, "EOD summary sent");
  }
}
