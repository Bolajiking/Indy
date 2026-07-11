import pino from "#logger";
import { AGENT } from "../../config/constants.js";
import { getDealsForCreator } from "../../db/queries/deals.js";
import llm from "../llm.js";
import { assembleContext } from "../memory.js";
import { formatUsdWhole } from "../../lib/format.js";

const log = pino({ name: "skill:morning-brief" });

export interface MorningBriefItem {
  emoji: string;
  title: string;
  detail: string;
  actionPrompt: string;
}

export interface MorningBrief {
  greeting: string;
  items: MorningBriefItem[];
  closingNote: string;
}

export async function generateMorningBrief(
  creatorId: string,
): Promise<MorningBrief> {
  log.info({ creatorId }, "Generating morning brief");

  const context = await assembleContext(creatorId);
  const deals = await getDealsForCreator(creatorId);
  const newDeals = deals.filter((deal) => deal.stage === "discovered");
  const activeDeals = deals.filter((deal) =>
    ["pitched", "responded", "negotiating"].includes(deal.stage),
  );

  const response = await llm.messages.create({
    model: AGENT.FAST_LLM,
    max_tokens: 1024,
    system: `You are Indyfren, a creator's AI business manager. Generate a morning brief with 2-3 items max. Each item should be actionable.

Format as JSON:
{
  "greeting": "Short greeting",
  "items": [
    {
      "emoji": "relevant emoji",
      "title": "Short headline",
      "detail": "1-2 sentence context",
      "actionPrompt": "What should I do?"
    }
  ],
  "closingNote": "One encouraging line"
}

Be specific, not generic. Reference actual deal names and numbers.`,
    messages: [
      {
        role: "user",
        content: `Context:\n${context}\n\nNew opportunities: ${newDeals.length}\nActive deals: ${activeDeals.length}\n\nNew deals:\n${newDeals
          .slice(0, 5)
          .map(
            (deal) =>
              `- ${deal.brand_name} (fit: ${deal.fit_score ?? "n/a"}, est: ${formatUsdWhole(deal.estimated_value_cents ?? 0)})`,
          )
          .join("\n")}\n\nActive deals:\n${activeDeals
          .map((deal) => `- ${deal.brand_name} [${deal.stage}]`)
          .join("\n")}`,
      },
    ],
  });

  const text =
    response.content.find((block) => block.type === "text")?.text ?? "";

  try {
    return JSON.parse(text) as MorningBrief;
  } catch (error) {
    log.error({ creatorId, error, text }, "Failed to parse morning brief");
    return {
      greeting: "Good morning! Here's your daily update.",
      items: [],
      closingNote: "Have a productive day!",
    };
  }
}
