import pino from "pino";
import { AGENT } from "../../config/constants.js";
import llm from "../llm.js";

const log = pino({ name: "skill:seo-optimizer" });

export interface SeoSuggestion {
  field: "title" | "description" | "tags" | "thumbnail" | "hook" | "hashtags";
  current: string;
  suggested: string;
  reason: string;
  impact: "high" | "medium" | "low";
}

export interface SeoAnalysis {
  overallScore: number;
  suggestions: SeoSuggestion[];
  keywordOpportunities: string[];
  competitorInsights: string;
}

export async function analyzeSeo(
  platform: string,
  content: {
    title?: string;
    description?: string;
    tags?: string[];
    niche?: string;
  },
): Promise<SeoAnalysis> {
  log.info({ platform, title: content.title }, "Running SEO analysis");

  const response = await llm.messages.create({
    model: AGENT.FAST_LLM,
    max_tokens: 2048,
    system: `You are an SEO and content optimization expert for ${platform}. Analyze the provided content metadata and suggest improvements for discoverability and engagement.

Return ONLY valid JSON:
{
  "overallScore": 0,
  "suggestions": [
    {
      "field": "title|description|tags|thumbnail|hook|hashtags",
      "current": "What they have",
      "suggested": "What you recommend",
      "reason": "Why this change helps",
      "impact": "high|medium|low"
    }
  ],
  "keywordOpportunities": ["keyword1", "keyword2"],
  "competitorInsights": "Brief analysis of what top creators in this niche do"
}

Score 0-100 based on: keyword usage, length optimization, engagement signals, platform-specific best practices.`,
    messages: [
      {
        role: "user",
        content: `Platform: ${platform}\nNiche: ${content.niche ?? "general"}\n\nTitle: ${content.title ?? "(none)"}\nDescription: ${content.description ?? "(none)"}\nTags: ${content.tags?.join(", ") ?? "(none)"}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";

  try {
    const parsed = JSON.parse(text) as SeoAnalysis;
    log.info(
      {
        platform,
        score: parsed.overallScore,
        suggestions: parsed.suggestions.length,
      },
      "SEO analysis complete",
    );
    return parsed;
  } catch (error) {
    log.error({ platform, error, text }, "Failed to parse SEO analysis");
    return {
      overallScore: 0,
      suggestions: [],
      keywordOpportunities: [],
      competitorInsights: "Unable to generate analysis at this time.",
    };
  }
}
