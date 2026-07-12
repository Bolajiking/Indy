import pino from "#logger";
import { AGENT } from "../../config/constants.js";
import { getDealsForCreator } from "../../db/queries/deals.js";
import { getTransactionsForCreator } from "../../db/queries/transactions.js";
import llm from "../llm.js";
import { assembleContext } from "../memory.js";

const log = pino({ name: "skill:revenue-advisor" });

export interface RevenueStream {
  source: string;
  estimatedMonthlyCents: number;
  trend: "growing" | "stable" | "declining";
  notes: string;
}

export interface DiversificationSuggestion {
  title: string;
  description: string;
  estimatedMonthlyCents: number;
  effort: "low" | "medium" | "high";
  priority: number;
}

export interface RevenueAdvisorReport {
  summary: string;
  currentStreams: RevenueStream[];
  totalEstimatedMonthlyCents: number;
  suggestions: DiversificationSuggestion[];
  riskAssessment: string;
}

export async function generateRevenueReport(
  creatorId: string,
): Promise<RevenueAdvisorReport> {
  log.info({ creatorId }, "Generating revenue diversification report");

  const [context, deals, transactions] = await Promise.all([
    assembleContext(creatorId),
    getDealsForCreator(creatorId),
    getTransactionsForCreator(creatorId),
  ]);

  const dealSummary = deals.map((d) => ({
    brand: d.brand_name,
    stage: d.stage,
    estimatedValue: d.estimated_value_cents,
    actualValue: d.actual_value_cents,
  }));

  const txSummary = transactions.slice(0, 50).map((t) => ({
    type: t.type,
    amount: t.amount_cents,
    description: t.description,
    createdAt: t.created_at,
  }));

  const response = await llm.messages.create({
    model: AGENT.DEFAULT_LLM,
    max_tokens: 2048,
    system: `You are a revenue strategist for content creators. Analyze the creator's current revenue streams and suggest diversification opportunities.

Return ONLY valid JSON in this shape:
{
  "summary": "Brief overview of revenue health",
  "currentStreams": [
    {
      "source": "e.g. Brand deals, YouTube AdSense, Merch",
      "estimatedMonthlyCents": 0,
      "trend": "growing|stable|declining",
      "notes": "Context"
    }
  ],
  "totalEstimatedMonthlyCents": 0,
  "suggestions": [
    {
      "title": "Short title",
      "description": "What to do and why",
      "estimatedMonthlyCents": 0,
      "effort": "low|medium|high",
      "priority": 1
    }
  ],
  "riskAssessment": "Analysis of revenue concentration risk"
}`,
    messages: [
      {
        role: "user",
        content: `Creator profile:\n${context}\n\nDeal history (${deals.length} deals):\n${JSON.stringify(dealSummary)}\n\nRecent transactions (${transactions.length}):\n${JSON.stringify(txSummary)}`,
      },
    ],
  });

  const text =
    response.content.find((block) => block.type === "text")?.text ?? "";

  try {
    const parsed = JSON.parse(text) as RevenueAdvisorReport;
    log.info(
      {
        creatorId,
        streams: parsed.currentStreams.length,
        suggestions: parsed.suggestions.length,
      },
      "Revenue report generated",
    );
    return parsed;
  } catch (error) {
    log.error({ creatorId, error, text }, "Failed to parse revenue report");
    return {
      summary: "Unable to generate revenue report at this time.",
      currentStreams: [],
      totalEstimatedMonthlyCents: 0,
      suggestions: [],
      riskAssessment: "Insufficient data for risk assessment.",
    };
  }
}
