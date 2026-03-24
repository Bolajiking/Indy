import pino from "pino";
import {
  getCreatorById,
  listCreatorsForMorningBriefs,
} from "../db/queries/creators.js";
import { generateRevenueReport } from "../agent/skills/revenue-advisor.js";
import { generateContentStrategy } from "../agent/skills/content-strategy.js";
import { generateFinancialSnapshot } from "../agent/skills/financial-tracker.js";
import { sendMessageToCreator } from "../bot/telegram.js";
import { sendWhatsAppMessage } from "../bot/whatsapp.js";

const log = pino({ name: "jobs:weekly-review" });

export async function runWeeklyReview(creatorId?: string): Promise<void> {
  if (creatorId) {
    await reviewSingleCreator(creatorId);
    return;
  }

  const creators = await listCreatorsForMorningBriefs();
  for (const creator of creators) {
    try {
      await reviewSingleCreator(creator.id);
    } catch (error) {
      log.error({ creatorId: creator.id, error }, "Weekly review failed");
    }
  }
}

async function reviewSingleCreator(creatorId: string): Promise<void> {
  const creator = await getCreatorById(creatorId);
  if (!creator) return;

  const [revenue, strategy, financial] = await Promise.all([
    generateRevenueReport(creatorId),
    generateContentStrategy(creatorId),
    generateFinancialSnapshot(creatorId),
  ]);

  const message = formatWeeklyReview(revenue, strategy, financial);

  const outgoing = { text: message, parseMode: "Markdown" as const };

  if (creator.telegram_chat_id) {
    await sendMessageToCreator(creator.telegram_chat_id, outgoing);
    log.info({ creatorId, platform: "telegram" }, "Weekly review sent");
  }

  if (creator.whatsapp_phone) {
    await sendWhatsAppMessage(creator.whatsapp_phone, outgoing);
    log.info({ creatorId, platform: "whatsapp" }, "Weekly review sent");
  }
}

function formatWeeklyReview(
  revenue: Awaited<ReturnType<typeof generateRevenueReport>>,
  strategy: Awaited<ReturnType<typeof generateContentStrategy>>,
  financial: Awaited<ReturnType<typeof generateFinancialSnapshot>>
): string {
  const formatUsd = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  let msg = `*Weekly Business Review*\n\n`;

  // Financial summary
  msg += `*Finances*\n`;
  msg += `Income: ${formatUsd(financial.income.totalCents)} | Expenses: ${formatUsd(financial.expenses.totalCents)} | Net: ${formatUsd(financial.netCents)}\n`;
  msg += `Pipeline: ${financial.pipeline.activeDealCount} deals worth ${formatUsd(financial.pipeline.totalPipelineValueCents)}\n`;
  msg += `Forecast: ${formatUsd(financial.forecast.nextMonthEstimateCents)}/mo (${financial.forecast.confidence} confidence)\n\n`;

  // Revenue health
  msg += `*Revenue Health*\n`;
  msg += `${revenue.summary}\n`;
  if (revenue.suggestions.length > 0) {
    msg += `Top suggestion: ${revenue.suggestions[0].title} — ${revenue.suggestions[0].description}\n`;
  }
  msg += `\n`;

  // Content strategy
  msg += `*Content Plan*\n`;
  msg += `Theme: ${strategy.weeklyTheme}\n`;
  for (const idea of strategy.ideas.slice(0, 3)) {
    msg += `• *${idea.title}* (${idea.platform}, ${idea.format})${idea.tieIn ? ` — ${idea.tieIn}` : ""}\n`;
  }

  if (strategy.trendOpportunities.length > 0) {
    msg += `\n*Trends to Watch:* ${strategy.trendOpportunities.slice(0, 2).join(", ")}\n`;
  }

  msg += `\n_Reply "details" for the full report or "adjust strategy" to tweak the plan._`;
  return msg;
}
