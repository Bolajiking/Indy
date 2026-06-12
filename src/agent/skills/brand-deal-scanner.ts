import pino from "pino";
import { AGENT } from "../../config/constants.js";
import { createDeal } from "../../db/queries/deals.js";
import llm from "../llm.js";
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
  sourceUrl: string;
  sourceEvidence: string;
  confidence: number;
  dedupeKey: string;
}

export interface ScanResult {
  status: "ok" | "no_sourced_opportunities" | "invalid_response";
  opportunities: ScanOpportunity[];
  errors?: string[];
}

type RawScanOpportunity = Partial<Omit<ScanOpportunity, "dedupeKey">> & {
  dedupeKey?: string;
};

function buildDedupeKey(brandName: string, sourceUrl: string): string {
  return `${brandName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}|${sourceUrl.trim()}`;
}

function validateOpportunity(raw: RawScanOpportunity): ScanOpportunity | null {
  if (
    !raw.brandName ||
    !raw.reason ||
    !raw.source ||
    !raw.sourceUrl ||
    !/^https?:\/\//i.test(raw.sourceUrl) ||
    !raw.sourceEvidence ||
    typeof raw.fitScore !== "number" ||
    raw.fitScore < 0 ||
    raw.fitScore > 100 ||
    typeof raw.estimatedValueCents !== "number" ||
    raw.estimatedValueCents <= 0 ||
    typeof raw.confidence !== "number" ||
    raw.confidence < 0 ||
    raw.confidence > 1
  ) {
    return null;
  }

  return {
    brandName: raw.brandName,
    contactEmail: raw.contactEmail,
    contactName: raw.contactName,
    fitScore: raw.fitScore,
    estimatedValueCents: raw.estimatedValueCents,
    reason: raw.reason,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    sourceEvidence: raw.sourceEvidence,
    confidence: raw.confidence,
    dedupeKey: raw.dedupeKey || buildDedupeKey(raw.brandName, raw.sourceUrl),
  };
}

export async function scanForBrandDeals(
  creatorId: string,
  niche: string,
  platforms: string[],
): Promise<ScanResult> {
  log.info({ creatorId, niche, platforms }, "Starting brand deal scan");

  const context = await assembleContext(creatorId);
  const response = await llm.messages.create({
    model: AGENT.FAST_LLM,
    max_tokens: 2048,
    system: `You are a brand deal researcher. Given a creator's profile, find up to 5 realistic brand deal opportunities ranked by fit score (highest first). Be selective — quality over quantity.

Only return opportunities grounded in a source you can cite. Do not invent brands, campaigns, creator programs, contact details, or deal availability. If you cannot cite a source URL with evidence, return an empty opportunities array.

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
      "source": "Where the opportunity came from",
      "sourceUrl": "https://source.example/path",
      "sourceEvidence": "Short evidence from the source that supports this opportunity",
      "confidence": 0.0
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

  const text =
    response.content.find((block) => block.type === "text")?.text ?? "";

  try {
    const parsed = JSON.parse(text) as { opportunities?: RawScanOpportunity[] };
    const validationErrors: string[] = [];
    const sourcedOpportunities = (parsed.opportunities ?? [])
      .map((opportunity) => {
        const validated = validateOpportunity(opportunity);
        if (!validated) {
          validationErrors.push(
            `Rejected ${opportunity.brandName ?? "unknown brand"}: sourceUrl, sourceEvidence, confidence, and valid deal fields are required`,
          );
        }
        return validated;
      })
      .filter((opportunity): opportunity is ScanOpportunity =>
        Boolean(opportunity),
      );

    // Sort by fit score and keep only the top 2 — well-curated beats volume
    const top2 = sourcedOpportunities
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 2);

    if (top2.length === 0) {
      return {
        status: "no_sourced_opportunities",
        opportunities: [],
        errors:
          validationErrors.length > 0
            ? validationErrors
            : ["No sourced opportunities were returned by the scanner"],
      };
    }

    for (const opportunity of top2) {
      await createDeal({
        creator_id: creatorId,
        brand_name: opportunity.brandName,
        brand_contact_email: opportunity.contactEmail,
        brand_contact_name: opportunity.contactName,
        fit_score: opportunity.fitScore,
        estimated_value_cents: opportunity.estimatedValueCents,
        notes: opportunity.reason,
        metadata: {
          source: opportunity.source,
          sourceUrl: opportunity.sourceUrl,
          sourceEvidence: opportunity.sourceEvidence,
          confidence: opportunity.confidence,
          dedupeKey: opportunity.dedupeKey,
        },
      });
    }

    return { status: "ok", opportunities: top2, errors: validationErrors };
  } catch (error) {
    log.error(
      { creatorId, error, text },
      "Failed to parse brand deal scan response",
    );
    return {
      status: "invalid_response",
      opportunities: [],
      errors: [
        error instanceof Error ? error.message : "Invalid scanner response",
      ],
    };
  }
}
