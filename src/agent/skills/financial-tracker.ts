import pino from "#logger";
import { getDealsForCreator } from "../../db/queries/deals.js";
import { getTransactionsForCreator } from "../../db/queries/transactions.js";

const log = pino({ name: "skill:financial-tracker" });

export interface FinancialSnapshot {
  creatorId: string;
  period: string;
  income: {
    totalCents: number;
    bySource: Record<string, number>;
  };
  expenses: {
    totalCents: number;
    agentSpendCents: number;
    byCategory: Record<string, number>;
  };
  netCents: number;
  pipeline: {
    activeDealCount: number;
    totalPipelineValueCents: number;
  };
  forecast: {
    nextMonthEstimateCents: number;
    confidence: "low" | "medium" | "high";
  };
}

export async function generateFinancialSnapshot(
  creatorId: string,
): Promise<FinancialSnapshot> {
  log.info({ creatorId }, "Generating financial snapshot");

  const [deals, transactions] = await Promise.all([
    getDealsForCreator(creatorId),
    getTransactionsForCreator(creatorId),
  ]);

  const completedDeals = deals.filter((d) => d.stage === "completed");
  const incomeBySource: Record<string, number> = {};
  let totalIncome = 0;

  for (const deal of completedDeals) {
    const value = deal.actual_value_cents ?? deal.estimated_value_cents ?? 0;
    totalIncome += value;
    const source = deal.brand_name || "Unknown";
    incomeBySource[source] = (incomeBySource[source] ?? 0) + value;
  }

  const expenseByCategory: Record<string, number> = {};
  let totalExpenses = 0;
  let agentSpend = 0;

  for (const tx of transactions) {
    if (tx.type === "mpp_payment" || tx.type === "agent_spend") {
      const amount = Math.abs(tx.amount_cents);
      totalExpenses += amount;
      agentSpend += amount;
      const category = tx.description || "Agent services";
      expenseByCategory[category] = (expenseByCategory[category] ?? 0) + amount;
    }
  }

  const activeDeals = deals.filter(
    (d) =>
      d.stage === "active" ||
      d.stage === "negotiating" ||
      d.stage === "pitched",
  );
  const pipelineValue = activeDeals.reduce(
    (sum, d) => sum + (d.estimated_value_cents ?? 0),
    0,
  );

  const monthsOfData = Math.max(1, getMonthSpan(completedDeals));
  const avgMonthlyIncome = Math.round(totalIncome / monthsOfData);
  // Forecast uses realized monthly income plus a conservative 30% pipeline close-rate estimate.
  const pipelineContribution = Math.round(pipelineValue * 0.3);
  const forecastCents = avgMonthlyIncome + pipelineContribution;

  const confidence: "low" | "medium" | "high" =
    completedDeals.length >= 5
      ? "high"
      : completedDeals.length >= 2
        ? "medium"
        : "low";

  const snapshot: FinancialSnapshot = {
    creatorId,
    period: new Date().toISOString().slice(0, 7), // YYYY-MM
    income: { totalCents: totalIncome, bySource: incomeBySource },
    expenses: {
      totalCents: totalExpenses,
      agentSpendCents: agentSpend,
      byCategory: expenseByCategory,
    },
    netCents: totalIncome - totalExpenses,
    pipeline: {
      activeDealCount: activeDeals.length,
      totalPipelineValueCents: pipelineValue,
    },
    forecast: {
      nextMonthEstimateCents: forecastCents,
      confidence,
    },
  };

  log.info(
    {
      creatorId,
      income: totalIncome,
      expenses: totalExpenses,
      pipeline: pipelineValue,
    },
    "Financial snapshot generated",
  );

  return snapshot;
}

function getMonthSpan(deals: Array<{ created_at: string }>): number {
  if (deals.length === 0) return 1;
  const dates = deals.map((d) => new Date(d.created_at).getTime());
  const oldest = Math.min(...dates);
  const newest = Math.max(...dates);
  return Math.max(1, Math.ceil((newest - oldest) / (30 * 24 * 60 * 60 * 1000)));
}
