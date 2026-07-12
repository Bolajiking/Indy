import pino from "#logger";
import { AGENT } from "../config/constants.js";
import { getDealsForCreator } from "../db/queries/deals.js";
import { getTransactionsForCreator } from "../db/queries/transactions.js";
import {
  getCreatorById,
  listCreatorsForMorningBriefs,
} from "../db/queries/creators.js";
import llm from "../agent/llm.js";
import { sendCreatorMessageToChannels } from "./creator-message.js";
import { runForCreators } from "./run-for-creators.js";

const log = pino({ name: "jobs:eod-summary" });

export async function runEndOfDaySummary(creatorId?: string): Promise<void> {
  await runForCreators(
    creatorId,
    listCreatorsForMorningBriefs,
    summarySingleCreator,
    log,
    "EOD summary failed",
  );
}

async function summarySingleCreator(creatorId: string): Promise<void> {
  const creator = await getCreatorById(creatorId);
  if (!creator) return;

  const [deals, transactions] = await Promise.all([
    getDealsForCreator(creatorId),
    getTransactionsForCreator(creatorId),
  ]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTs = todayStart.getTime();

  const todayDeals = deals.filter(
    (d) => new Date(d.updated_at).getTime() >= todayTs,
  );
  const todayTx = transactions.filter(
    (t) => new Date(t.created_at).getTime() >= todayTs,
  );

  if (todayDeals.length === 0 && todayTx.length === 0) {
    log.info({ creatorId }, "No activity today — skipping EOD summary");
    return;
  }

  const response = await llm.messages.create({
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
          })),
        )}\n\nTransactions today (${todayTx.length}):\n${JSON.stringify(
          todayTx.map((t) => ({
            type: t.type,
            amount: t.amount_cents,
            description: t.description,
          })),
        )}`,
      },
    ],
  });

  const text =
    response.content.find((b) => b.type === "text")?.text ??
    "No summary generated.";

  const outgoing = {
    text: `*End-of-Day Summary*\n\n${text}`,
    parseMode: "Markdown" as const,
  };

  await sendCreatorMessageToChannels(
    creatorId,
    creator,
    outgoing,
    log,
    "EOD summary sent",
  );
}
