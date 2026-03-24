/**
 * Deal management tools — allow the agent to persist deals and update their stage.
 *
 * These are autonomous (no approval needed) because they are data writes within
 * the creator's own account. They have zero cost.
 */

import { registerTool } from "./registry.js";
import { createDeal, updateDealStage, getDealByIdForCreator } from "../../db/queries/deals.js";
import type { DealStage } from "../../config/constants.js";

registerTool({
  name: "create_deal",
  description:
    "Save a NEW brand deal opportunity to the creator's deal pipeline. IMPORTANT: First check the Active Deals in context — if the brand is already listed there, call update_deal_stage instead (never create a duplicate). This tool is idempotent: if the same brand already exists in a non-terminal stage it will update rather than insert. Required: brand_name, fit_score, estimated_value_cents. Optional: contact_email, contact_name, notes.",
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
      description: "Fit score from 1-100 indicating how well this brand matches the creator",
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
      description: "Why this brand is a good fit and recommended outreach approach",
    },
  },
  async execute(params, context) {
    const deal = await createDeal({
      creator_id: context.creatorId,
      brand_name: params.brand_name as string,
      fit_score: params.fit_score as number,
      estimated_value_cents: params.estimated_value_cents as number,
      brand_contact_email: (params.contact_email as string) ?? null,
      brand_contact_name: (params.contact_name as string) ?? null,
      notes: (params.notes as string) ?? null,
      metadata: {},
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
    const dealId = params.deal_id as string;

    // Verify this deal belongs to this creator
    const existing = await getDealByIdForCreator(context.creatorId, dealId);
    if (!existing) {
      return {
        success: false,
        data: null,
        error: `Deal ${dealId} not found for this creator`,
      };
    }

    const extra: Record<string, unknown> = {};
    if (params.pitch_text) extra.pitch_text = params.pitch_text;
    if (params.response_text) extra.response_text = params.response_text;
    if (params.contract_notes) extra.contract_notes = params.contract_notes;
    if (params.notes) extra.notes = params.notes;

    const updated = await updateDealStage(
      dealId,
      params.stage as DealStage,
      extra as any
    );

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
