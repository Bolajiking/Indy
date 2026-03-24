import pino from "pino";
import { AGENT } from "../../config/constants.js";
import { getDealsForCreator } from "../../db/queries/deals.js";
import { getConnectionsForCreator } from "../../db/queries/platform-connections.js";
import anthropic from "../anthropic.js";
import { assembleContext } from "../memory.js";

const log = pino({ name: "skill:content-strategy" });

export interface ContentIdea {
  title: string;
  platform: string;
  format: string;
  description: string;
  tieIn?: string;
  priority: number;
}

export interface ContentStrategyReport {
  summary: string;
  weeklyTheme: string;
  ideas: ContentIdea[];
  bestPostingTimes: Record<string, string>;
  trendOpportunities: string[];
}

export async function generateContentStrategy(
  creatorId: string
): Promise<ContentStrategyReport> {
  log.info({ creatorId }, "Generating content strategy");

  const [context, deals, connections] = await Promise.all([
    assembleContext(creatorId),
    getDealsForCreator(creatorId),
    getConnectionsForCreator(creatorId),
  ]);

  const activeDeals = deals
    .filter((d) => d.stage === "active" || d.stage === "negotiating")
    .map((d) => ({ brand: d.brand_name, stage: d.stage, value: d.estimated_value_cents }));

  const platforms = connections.map((c) => c.platform);

  const response = await anthropic.messages.create({
    model: AGENT.DEFAULT_LLM,
    max_tokens: 2048,
    system: `You are a content strategist for creators. Generate a weekly content strategy based on their profile, active deals, and connected platforms.

Return ONLY valid JSON:
{
  "summary": "Brief strategy overview",
  "weeklyTheme": "Theme for the week",
  "ideas": [
    {
      "title": "Content title",
      "platform": "youtube|instagram|tiktok|twitter",
      "format": "video|reel|story|post|thread|short",
      "description": "What to create and why",
      "tieIn": "Optional brand deal tie-in",
      "priority": 1
    }
  ],
  "bestPostingTimes": { "youtube": "Tuesday 2pm", "instagram": "Daily 9am" },
  "trendOpportunities": ["Trend 1 to capitalize on"]
}`,
    messages: [
      {
        role: "user",
        content: `Creator profile:\n${context}\n\nConnected platforms: ${platforms.join(", ") || "none"}\n\nActive deals (${activeDeals.length}):\n${JSON.stringify(activeDeals)}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";

  try {
    const parsed = JSON.parse(text) as ContentStrategyReport;
    log.info(
      { creatorId, ideas: parsed.ideas.length },
      "Content strategy generated"
    );
    return parsed;
  } catch (error) {
    log.error({ creatorId, error, text }, "Failed to parse content strategy");
    return {
      summary: "Unable to generate content strategy at this time.",
      weeklyTheme: "",
      ideas: [],
      bestPostingTimes: {},
      trendOpportunities: [],
    };
  }
}
