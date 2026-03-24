import { AGENT } from "../../config/constants.js";
import anthropic from "../anthropic.js";
import { assembleContext } from "../memory.js";

export interface RateCard {
  platform: string;
  contentType: string;
  recommendedRateCents: number;
  rangeLowCents: number;
  rangeHighCents: number;
  reasoning: string;
}

export async function calculateRates(
  creatorId: string,
  followerCount: number,
  engagementRate: number,
  niche: string,
  platforms: string[]
): Promise<RateCard[]> {
  const context = await assembleContext(creatorId);

  const response = await anthropic.messages.create({
    model: AGENT.FAST_LLM,
    max_tokens: 2048,
    system: `You are a creator economy pricing expert. Given a creator's stats, calculate recommended brand deal rates for each platform and content type.

Use these market benchmarks:
- Instagram post: $10-$100 per 1K followers, adjusted by engagement rate
- Instagram Reel: 1.5-2x post rate
- YouTube integration (30-60s): $20-$50 per 1K subscribers
- YouTube dedicated video: $50-$100 per 1K subscribers
- TikTok post: $5-$25 per 1K followers
- Twitter/X thread: $5-$15 per 1K followers
- Newsletter mention: $20-$50 per 1K subscribers

Higher engagement rates (>3%) command premium pricing. Finance/B2B niches pay 3-5x entertainment.

Return ONLY valid JSON: [{ "platform": "...", "contentType": "...", "recommendedRateCents": 0, "rangeLowCents": 0, "rangeHighCents": 0, "reasoning": "..." }]`,
    messages: [
      {
        role: "user",
        content: `Followers: ${followerCount}\nEngagement rate: ${engagementRate}%\nNiche: ${niche}\nPlatforms: ${platforms.join(", ")}\n\nContext:\n${context}`,
      },
    ],
  });

  const text = response.content.find((block) => block.type === "text")?.text ?? "[]";

  try {
    return JSON.parse(text) as RateCard[];
  } catch {
    return [];
  }
}
