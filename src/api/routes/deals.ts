import { Hono } from "hono";
import {
  createDeal,
  getDealByIdForCreator,
  getDealsForCreator,
  updateDeal,
  updateDealStage,
  type CreateDealInput,
  type UpdateDealInput,
} from "../../db/queries/deals.js";
import {
  DEAL_STAGES,
  isDealStage,
  type DealStage,
} from "../../config/constants.js";
import { isJsonObject, isJsonObjectArray } from "../../db/json.js";
import { getAuthContext, requireCreatorAuth } from "../middleware/auth.js";
import type { ApiDeal, ApiDealStageUpdateInput } from "../contracts.js";

export const deals = new Hono();
const INVALID_DEAL_STAGE_ERROR = `Invalid stage. Supported stages: ${DEAL_STAGES.join(", ")}`;

deals.use("*", requireCreatorAuth);

deals.get("/", async (context) => {
  const { creatorId } = getAuthContext(context);
  const stage = context.req.query("stage") as DealStage | undefined;
  const result = await getDealsForCreator(creatorId!, stage);
  return context.json(result satisfies ApiDeal[]);
});

deals.get("/:dealId", async (context) => {
  const { creatorId } = getAuthContext(context);
  const deal = await getDealByIdForCreator(
    creatorId!,
    context.req.param("dealId"),
  );
  if (!deal) {
    return context.json({ error: "Not found" }, 404);
  }

  return context.json(deal satisfies ApiDeal);
});

type StringDealField = keyof Pick<
  UpdateDealInput,
  | "brand_contact_email"
  | "brand_contact_name"
  | "brand_domain"
  | "source_url"
  | "source_type"
  | "deadline_at"
  | "follow_up_at"
  | "next_action"
  | "pitch_text"
  | "pitch_sent_at"
  | "response_text"
  | "responded_at"
  | "contract_notes"
  | "notes"
  | "archived_at"
>;

type NumberDealField = keyof Pick<
  UpdateDealInput,
  | "fit_score"
  | "estimated_value_cents"
  | "actual_value_cents"
  | "source_confidence"
  | "probability"
>;

function setStringField(
  mapped: UpdateDealInput,
  field: StringDealField,
  value: string | null,
): void {
  mapped[field] = value;
}

function setNumberField(
  mapped: UpdateDealInput,
  field: NumberDealField,
  value: number | null,
): void {
  mapped[field] = value;
}

function mapDealBody(body: Record<string, unknown>): UpdateDealInput {
  const mapped: UpdateDealInput = {};

  if (typeof body.brandName === "string") {
    mapped.brand_name = body.brandName;
  }

  const stringFields: Array<[string, StringDealField]> = [
    ["brandContactEmail", "brand_contact_email"],
    ["brandContactName", "brand_contact_name"],
    ["brandDomain", "brand_domain"],
    ["sourceUrl", "source_url"],
    ["sourceType", "source_type"],
    ["deadlineAt", "deadline_at"],
    ["followUpAt", "follow_up_at"],
    ["nextAction", "next_action"],
    ["pitchText", "pitch_text"],
    ["pitchSentAt", "pitch_sent_at"],
    ["responseText", "response_text"],
    ["respondedAt", "responded_at"],
    ["contractNotes", "contract_notes"],
    ["notes", "notes"],
    ["archivedAt", "archived_at"],
  ];

  for (const [inputKey, outputKey] of stringFields) {
    const value = body[inputKey];
    if (typeof value === "string") {
      setStringField(mapped, outputKey, value);
    } else if (value === null) {
      setStringField(mapped, outputKey, null);
    }
  }

  const numberFields: Array<[string, NumberDealField]> = [
    ["fitScore", "fit_score"],
    ["estimatedValueCents", "estimated_value_cents"],
    ["actualValueCents", "actual_value_cents"],
    ["sourceConfidence", "source_confidence"],
    ["probability", "probability"],
  ];
  for (const [inputKey, outputKey] of numberFields) {
    const value = body[inputKey];
    if (typeof value === "number" && Number.isFinite(value)) {
      setNumberField(mapped, outputKey, value);
    } else if (value === null) {
      setNumberField(mapped, outputKey, null);
    }
  }

  if (isJsonObjectArray(body.sourceEvidence)) {
    mapped.source_evidence = body.sourceEvidence;
  }
  if (isJsonObjectArray(body.deliverables)) {
    mapped.deliverables = body.deliverables;
  }
  if (isJsonObject(body.agentProvenance)) {
    mapped.agent_provenance = body.agentProvenance;
  }
  if (isJsonObject(body.metadata)) {
    mapped.metadata = body.metadata;
  }

  if (typeof body.stage === "string") {
    mapped.stage = body.stage as DealStage;
  }

  return mapped;
}

function dealStageError(stage: string | undefined): string | null {
  if (stage && !isDealStage(stage)) {
    return INVALID_DEAL_STAGE_ERROR;
  }

  return null;
}

deals.post("/", async (context) => {
  const { creatorId } = getAuthContext(context);
  const body = await context.req.json<Record<string, unknown>>();
  const brandName =
    typeof body.brandName === "string" ? body.brandName.trim() : "";
  if (!brandName) {
    return context.json({ error: "brandName is required" }, 400);
  }

  const mapped = mapDealBody(body);
  const stageError = dealStageError(mapped.stage);
  if (stageError) {
    return context.json({ error: stageError }, 400);
  }

  const created = await createDeal({
    ...(mapped as Omit<CreateDealInput, "creator_id" | "brand_name">),
    creator_id: creatorId!,
    brand_name: brandName,
  });
  return context.json(created satisfies ApiDeal, 201);
});

deals.patch("/:dealId", async (context) => {
  const { creatorId } = getAuthContext(context);
  const dealId = context.req.param("dealId");
  const existing = await getDealByIdForCreator(creatorId!, dealId);
  if (!existing) {
    return context.json({ error: "Not found" }, 404);
  }

  const body = await context.req.json<Record<string, unknown>>();
  const mapped = mapDealBody(body);
  const stageError = dealStageError(mapped.stage);
  if (stageError) {
    return context.json({ error: stageError }, 400);
  }

  const updated = await updateDeal(dealId, mapped);
  return context.json(updated satisfies ApiDeal);
});

deals.patch("/:dealId/stage", async (context) => {
  const { creatorId } = getAuthContext(context);
  const dealId = context.req.param("dealId");

  // Verify ownership before mutating
  const existing = await getDealByIdForCreator(creatorId!, dealId);
  if (!existing) {
    return context.json({ error: "Not found" }, 404);
  }

  const body = await context.req.json<Partial<ApiDealStageUpdateInput>>();
  if (!body.stage) {
    return context.json({ error: "stage is required" }, 400);
  }
  const stageError = dealStageError(body.stage);
  if (stageError) {
    return context.json({ error: stageError }, 400);
  }

  const updated = await updateDealStage(dealId, body.stage);
  return context.json(updated satisfies ApiDeal);
});
