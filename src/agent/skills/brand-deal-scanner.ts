import pino from "pino";
import { AGENT } from "../../config/constants.js";
import { createDeal } from "../../db/queries/deals.js";
import anthropic from "../anthropic.js";
import { assembleContext } from "../memory.js";

const log = pino({ name: "skill:brand-deal-scanner" });

export interface ScanOpportunity {
  brandName: string;
  contactEmail?: string;
  contactName?: string;
  fitScore: number;
  estimatedValueCents: number;
  reason: string;
  source: string;
}

export interface ScanResult {
  opportunities: ScanOpportunity[];
}

export async function scanForBrandDeals(
  creatorId: string,
  niche: string,
  platforms: string[]
): Promise<ScanResult> {
  log.info({ creatorId, niche, platforms }, "Starting brand deal scan");

  const context = await assembleContext(creatorId);
  const response = await anthropic.messages.create({
    model: AGENT.FAST_LLM,
    max_tokens: 2048,
    system: `You are a brand deal researcher. Given a creator's profile, generate exactly 5 realistic brand deal opportunities ranked by fit score (highest first). Be selective — quality over quantity.

Return ONLY valid JSON in this shape:
{
  "opportunities": [
    {
      "brandName": "Company name",
      "contactEmail": "optional@email.com",
      "contactName": "Optional name",
      "fitScore": 0,
      "estimatedValueCents": 0,
      "reason": "Why this brand is a fit",
      "source": "Where the opportunity came from"
    }
  ]
}`,
    messages: [
      {
        role: "user",
        content: `Creator profile:\n${context}\n\nNiche: ${niche}\nPlatforms: ${platforms.join(", ")}`,
      },
    ],
  });

  const text = response.content.find((block) => block.type === "text")?.text ?? "";

  try {
    const parsed = JSON.parse(text) as ScanResult;

    // Sort by fit score and keep only the top 2 — well-curated beats volume
    const top2 = [...parsed.opportunities]
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 2);

    for (const opportunity of top2) {
      await createDeal({
        creator_id: creatorId,
        brand_name: opportunity.brandName,
        brand_contact_email: opportunity.contactEmail,
        brand_contact_name: opportunity.contactName,
        fit_score: opportunity.fitScore,
        estimated_value_cents: opportunity.estimatedValueCents,
        notes: opportunity.reason,
        metadata: { source: opportunity.source },
      });
    }

    return { opportunities: top2 };
  } catch (error) {
    log.error({ creatorId, error, text }, "Failed to parse brand deal scan response");
    return { opportunities: [] };
  }
}
