import pino from "#logger";
import {
  getCreatorById,
  listCreatorsForMorningBriefs,
} from "../db/queries/creators.js";
import { generateRevenueReport } from "../agent/skills/revenue-advisor.js";
import { generateContentStrategy } from "../agent/skills/content-strategy.js";
import { generateFinancialSnapshot } from "../agent/skills/financial-tracker.js";
import { sendCreatorMessageToChannels } from "./creator-message.js";
import { runForCreators } from "./run-for-creators.js";
import { formatUsdWhole } from "../lib/format.js";

const log = pino({ name: "jobs:weekly-review" });

export async function runWeeklyReview(creatorId?: string): Promise<void> {
  await runForCreators(
    creatorId,
    listCreatorsForMorningBriefs,
    reviewSingleCreator,
    log,
    "Weekly review failed",
  );
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

  await sendCreatorMessageToChannels(
    creatorId,
    creator,
    outgoing,
    log,
    "Weekly review sent",
  );
}

function formatWeeklyReview(
  revenue: Awaited<ReturnType<typeof generateRevenueReport>>,
  strategy: Awaited<ReturnType<typeof generateContentStrategy>>,
  financial: Awaited<ReturnType<typeof generateFinancialSnapshot>>,
): string {
  let msg = `*Weekly Business Review*\n\n`;

  msg += `*Finances*\n`;
  msg += `Income: ${formatUsdWhole(financial.income.totalCents)} | Expenses: ${formatUsdWhole(financial.expenses.totalCents)} | Net: ${formatUsdWhole(financial.netCents)}\n`;
  msg += `Pipeline: ${financial.pipeline.activeDealCount} deals worth ${formatUsdWhole(financial.pipeline.totalPipelineValueCents)}\n`;
  msg += `Forecast: ${formatUsdWhole(financial.forecast.nextMonthEstimateCents)}/mo (${financial.forecast.confidence} confidence)\n\n`;

  msg += `*Revenue Health*\n`;
  msg += `${revenue.summary}\n`;
  if (revenue.suggestions.length > 0) {
    msg += `Top suggestion: ${revenue.suggestions[0].title} — ${revenue.suggestions[0].description}\n`;
  }
  msg += `\n`;

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
