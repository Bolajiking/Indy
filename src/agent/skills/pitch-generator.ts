import { AGENT } from "../../config/constants.js";
import { getDealById, updateDealStage } from "../../db/queries/deals.js";
import anthropic from "../anthropic.js";
import { assembleContext } from "../memory.js";

export interface PitchDraft {
  subject: string;
  body: string;
  dealId: string;
}

export async function generatePitch(
  creatorId: string,
  dealId: string
): Promise<PitchDraft | null> {
  const deal = await getDealById(dealId);
  if (!deal) {
    return null;
  }

  const context = await assembleContext(creatorId);
  const response = await anthropic.messages.create({
    model: AGENT.DEFAULT_LLM,
    max_tokens: 1500,
    system: `You are a brand deal pitch writer. Write a concise, professional, but warm outreach email from a content creator to a brand.

Rules:
- Subject line should be catchy but professional (under 60 chars)
- Body should be 150-250 words max
- Open with something specific about the brand
- Explain why the creator is a fit
- Propose specific deliverables and rate
- End with a clear CTA
- Tone: confident, specific, human

Return ONLY valid JSON: { "subject": "...", "body": "..." }`,
    messages: [
      {
        role: "user",
        content: `Creator context:\n${context}\n\nBrand: ${deal.brand_name}\nFit score: ${deal.fit_score ?? "unknown"}/100\nEstimated deal value: $${((deal.estimated_value_cents ?? 0) / 100).toFixed(0)}\nNotes: ${deal.notes ?? "none"}`,
      },
    ],
  });

  const text = response.content.find((block) => block.type === "text")?.text ?? "";

  try {
    const parsed = JSON.parse(text) as { subject: string; body: string };
    await updateDealStage(dealId, deal.stage, { pitch_text: parsed.body });
    return { ...parsed, dealId };
  } catch {
    return null;
  }
}
