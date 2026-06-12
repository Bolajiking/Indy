/**
 * Deal management tools — allow the agent to persist deals and update their stage.
 *
 * These are autonomous (no approval needed) because they are data writes within
 * the creator's own account. They have zero cost.
 */

import { readNumberParam, readStringParam, registerTool } from "./registry.js";
import {
  createDeal,
  updateDealStage,
  getDealByIdForCreator,
  type Deal,
} from "../../db/queries/deals.js";
import { isDealStage, type DealStage } from "../../config/constants.js";
import type { JsonObject } from "../../db/json.js";

function readDealStage(value: unknown): DealStage | null {
  return isDealStage(value) ? value : null;
}

registerTool({
  name: "create_deal",
  description:
    "Save a NEW brand deal opportunity to the creator's deal pipeline. IMPORTANT: First check the Active Deals in context — if the brand is already listed there, call update_deal_stage instead (never create a duplicate). This tool is idempotent: if the same brand already exists in a non-terminal stage it will update rather than insert. Required: brand_name, fit_score, estimated_value_cents. For discovered opportunities, include source_url, source_evidence, confidence, and dedupe_key so the deal is evidence-backed. Optional: contact_email, contact_name, notes.",
  autonomyLevel: "autonomous",
  costCategory: "free",
  maxCostPerUseCents: 0,
  parameters: {
    brand_name: {
      type: "string",
      description: "Name of the brand",
      required: true,
    },
    fit_score: {
      type: "number",
      description:
        "Fit score from 1-100 indicating how well this brand matches the creator",
      required: true,
    },
    estimated_value_cents: {
      type: "number",
      description: "Estimated deal value in cents (e.g. 50000 = $500)",
      required: true,
    },
    contact_email: {
      type: "string",
      description: "Brand contact email if known",
    },
    contact_name: {
      type: "string",
      description: "Brand contact name if known",
    },
    notes: {
      type: "string",
      description:
        "Why this brand is a good fit and recommended outreach approach",
    },
    source_url: {
      type: "string",
      description: "URL of the source proving this brand opportunity exists",
    },
    source_evidence: {
      type: "string",
      description: "Short evidence from the source supporting the opportunity",
    },
    confidence: {
      type: "number",
      description: "Confidence in this sourced opportunity from 0 to 1",
    },
    dedupe_key: {
      type: "string",
      description:
        "Stable dedupe key, usually normalized brand plus source URL",
    },
  },
  async execute(params, context) {
    const brandName = readStringParam(params, "brand_name");
    const fitScore = readNumberParam(params, "fit_score");
    const estimatedValueCents = readNumberParam(
      params,
      "estimated_value_cents",
    );

    if (!brandName || fitScore === null || estimatedValueCents === null) {
      return {
        success: false,
        data: null,
        error: "brand_name, fit_score, and estimated_value_cents are required",
      };
    }

    const sourceUrl = readStringParam(params, "source_url");
    const sourceEvidence = readStringParam(params, "source_evidence");
    const confidence = readNumberParam(params, "confidence");
    const dedupeKey = readStringParam(params, "dedupe_key");

    if (
      context.activeSkill === "brand-deal-scanner" &&
      (!sourceUrl || !sourceEvidence || confidence === null || !dedupeKey)
    ) {
      return {
        success: false,
        data: null,
        error:
          "brand-deal-scanner requires source_url, source_evidence, confidence, and dedupe_key before saving a discovered deal",
      };
    }

    const metadata: JsonObject = {};
    if (sourceUrl) metadata.sourceUrl = sourceUrl;
    if (sourceEvidence) metadata.sourceEvidence = sourceEvidence;
    if (confidence !== null) metadata.confidence = confidence;
    if (dedupeKey) metadata.dedupeKey = dedupeKey;

    const deal = await createDeal({
      creator_id: context.creatorId,
      brand_name: brandName,
      fit_score: fitScore,
      estimated_value_cents: estimatedValueCents,
      brand_contact_email: readStringParam(params, "contact_email"),
      brand_contact_name: readStringParam(params, "contact_name"),
      notes: readStringParam(params, "notes"),
      metadata,
    });

    return {
      success: true,
      data: {
        id: deal.id,
        brand_name: deal.brand_name,
        stage: deal.stage,
        fit_score: deal.fit_score,
        estimated_value_cents: deal.estimated_value_cents,
      },
    };
  },
});

registerTool({
  name: "update_deal_stage",
  description:
    "Update the stage of an existing deal in the pipeline. Valid stages: discovered, pitched, responded, negotiating, contracted, active, completed, lost. Also use this to record pitch text, response text, or contract notes.",
  autonomyLevel: "autonomous",
  costCategory: "free",
  maxCostPerUseCents: 0,
  parameters: {
    deal_id: {
      type: "string",
      description: "The deal ID to update",
      required: true,
    },
    stage: {
      type: "string",
      description:
        "New stage: discovered | pitched | responded | negotiating | contracted | active | completed | lost",
      required: true,
    },
    pitch_text: {
      type: "string",
      description: "Pitch email text (set when moving to pitched stage)",
    },
    response_text: {
      type: "string",
      description: "Brand response text (set when moving to responded stage)",
    },
    contract_notes: {
      type: "string",
      description: "Contract review notes (set when reviewing a contract)",
    },
    notes: {
      type: "string",
      description: "General notes to attach to the deal",
    },
  },
  async execute(params, context) {
    const dealId = readStringParam(params, "deal_id");
    const stage = readDealStage(params.stage);

    if (!dealId || !stage) {
      return {
        success: false,
        data: null,
        error: "deal_id and a valid stage are required",
      };
    }

    // Verify this deal belongs to this creator
    const existing = await getDealByIdForCreator(context.creatorId, dealId);
    if (!existing) {
      return {
        success: false,
        data: null,
        error: `Deal ${dealId} not found for this creator`,
      };
    }

    const extra: Partial<
      Pick<Deal, "pitch_text" | "response_text" | "contract_notes" | "notes">
    > = {};
    const pitchText = readStringParam(params, "pitch_text");
    const responseText = readStringParam(params, "response_text");
    const contractNotes = readStringParam(params, "contract_notes");
    const notes = readStringParam(params, "notes");

    if (pitchText) extra.pitch_text = pitchText;
    if (responseText) extra.response_text = responseText;
    if (contractNotes) extra.contract_notes = contractNotes;
    if (notes) extra.notes = notes;

    const updated = await updateDealStage(dealId, stage, extra);

    return {
      success: true,
      data: {
        id: updated.id,
        brand_name: updated.brand_name,
        stage: updated.stage,
        updated_at: updated.updated_at,
      },
    };
  },
});
