/**
 * Agentic OS Router
 *
 * Classifies user intent and routes to the appropriate skill sub-agent.
 * Uses Claude Haiku for fast, cheap classification.
 */

import pino from "pino";
import { AGENT } from "../../config/constants.js";
import anthropic from "../anthropic.js";

const log = pino({ name: "agent:os:router" });

export type SkillName =
  | "brand-deal-scanner"
  | "rate-calculator"
  | "pitch-generator"
  | "contract-reviewer"
  | "revenue-advisor"
  | "financial-tracker"
  | "morning-brief"
  | "analytics-aggregator"
  | "content-strategy"
  | "inbox-triager"
  | "calendar-manager"
  | "seo-optimizer"
  | "general"; // Falls back to main orchestrator

export interface RouteResult {
  skill: SkillName;
  confidence: number;
  extractedParams: Record<string, string>;
  reasoning: string;
}

const SKILL_DESCRIPTIONS: Record<SkillName, string> = {
  "brand-deal-scanner":
    "Find brand deal opportunities, scan for sponsorship leads, discover brands looking for creators in a niche",
  "rate-calculator":
    "Calculate rates, pricing for sponsored posts, what to charge brands, rate card, market rates",
  "pitch-generator":
    "Write pitch emails, draft outreach messages to brands, create sponsorship proposals",
  "contract-reviewer":
    "Review contracts, analyze deal terms, flag unfavorable clauses, check exclusivity, payment terms",
  "revenue-advisor":
    "Revenue diversification, new income streams, monetization strategy, financial advice",
  "financial-tracker":
    "Financial snapshot, income tracking, expenses, earnings, transaction history, money overview",
  "morning-brief":
    "Morning brief, daily summary, what happened, daily update, start of day report",
  "analytics-aggregator":
    "Social media analytics, follower counts, engagement rate, views, reach, platform stats",
  "content-strategy":
    "Content plan, content calendar, content ideas, what to post, posting schedule, content strategy",
  "inbox-triager":
    "Email triage, inbox management, organize emails, which emails to prioritize, email sorting",
  "calendar-manager":
    "Calendar, deadlines, upcoming events, schedule, due dates, time management",
  "seo-optimizer":
    "SEO optimization, search rankings, YouTube SEO, description optimization, keywords, discoverability",
  general:
    "General conversation, greetings, questions about the agent, account info, wallet balance, fallback",
};

const CLASSIFICATION_SYSTEM = `You are an intent classifier for an AI business manager for content creators.
Given a user message, classify which skill should handle it.

Available skills:
${Object.entries(SKILL_DESCRIPTIONS)
  .map(([name, desc]) => `- ${name}: ${desc}`)
  .join("\n")}

Return ONLY valid JSON:
{
  "skill": "skill-name",
  "confidence": 0.9,
  "extractedParams": {
    "key": "value"
  },
  "reasoning": "Brief reason why this skill"
}

extractedParams should contain any specific parameters mentioned (brand names, platforms, timeframes, etc).`;

export async function routeToSkill(
  userMessage: string,
  creatorContext?: string
): Promise<RouteResult> {
  const contextHint = creatorContext
    ? `\nCreator context summary: ${creatorContext.slice(0, 200)}`
    : "";

  try {
    const response = await anthropic.messages.create({
      model: AGENT.FAST_LLM,
      max_tokens: 512,
      system: CLASSIFICATION_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Message: "${userMessage}"${contextHint}`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned) as RouteResult;

    log.info(
      { skill: parsed.skill, confidence: parsed.confidence },
      "Routed message to skill"
    );
    return parsed;
  } catch (err) {
    log.warn({ err, userMessage: userMessage.slice(0, 50) }, "Router failed, defaulting to general");
    return {
      skill: "general",
      confidence: 0.5,
      extractedParams: {},
      reasoning: "Router failed, falling back to general agent",
    };
  }
}
