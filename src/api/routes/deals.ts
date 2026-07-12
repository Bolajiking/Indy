import { Hono } from "hono";
import {
  createDeal,
  getDealByIdForCreator,
  getDealsForCreator,
  updateDeal,
  updateDealStage,
  type UpdateDealInput,
} from "../../db/queries/deals.js";
import { isDealStage, type DealStage } from "../../config/constants.js";
import { getAuthContext, requireCreatorAuth } from "../middleware/auth.js";
import type { ApiDeal } from "../contracts.js";
import {
  createDealRequestSchema,
  updateDealRequestSchema,
  updateDealStageRequestSchema,
  zodFieldErrors,
  type DealRequest,
} from "../deal-schemas.js";

export const deals = new Hono();
deals.use("*", requireCreatorAuth);

async function parseBody(context: { req: { json: <T>() => Promise<T> } }) {
  try {
    return await context.req.json<unknown>();
  } catch {
    return null;
  }
}

function validationError(error: Parameters<typeof zodFieldErrors>[0]) {
  return { error: "Validation failed", fieldErrors: zodFieldErrors(error) };
}

function mapDealBody(body: Partial<DealRequest>): UpdateDealInput {
  const names: Array<[keyof DealRequest, keyof UpdateDealInput]> = [
    ["brandName", "brand_name"],
    ["brandContactEmail", "brand_contact_email"],
    ["brandContactName", "brand_contact_name"],
    ["brandDomain", "brand_domain"],
    ["stage", "stage"],
    ["fitScore", "fit_score"],
    ["estimatedValueCents", "estimated_value_cents"],
    ["actualValueCents", "actual_value_cents"],
    ["sourceUrl", "source_url"],
    ["sourceType", "source_type"],
    ["sourceConfidence", "source_confidence"],
    ["sourceEvidence", "source_evidence"],
    ["deliverables", "deliverables"],
    ["deadlineAt", "deadline_at"],
    ["followUpAt", "follow_up_at"],
    ["probability", "probability"],
    ["nextAction", "next_action"],
    ["agentProvenance", "agent_provenance"],
    ["archivedAt", "archived_at"],
    ["pitchText", "pitch_text"],
    ["pitchSentAt", "pitch_sent_at"],
    ["responseText", "response_text"],
    ["respondedAt", "responded_at"],
    ["contractNotes", "contract_notes"],
    ["notes", "notes"],
    ["metadata", "metadata"],
  ];
  const mapped: Record<string, unknown> = {};
  for (const [input, output] of names) {
    if (body[input] !== undefined) mapped[output] = body[input];
  }
  return mapped as UpdateDealInput;
}

deals.get("/", async (context) => {
  const { creatorId } = getAuthContext(context);
  const rawStage = context.req.query("stage");
  if (rawStage && !isDealStage(rawStage)) {
    return context.json(
      {
        error: "Validation failed",
        fieldErrors: { stage: ["Invalid deal stage"] },
      },
      400,
    );
  }
  const stage = rawStage as DealStage | undefined;
  return context.json(
    (await getDealsForCreator(creatorId!, stage)) satisfies ApiDeal[],
  );
});

deals.get("/:dealId", async (context) => {
  const { creatorId } = getAuthContext(context);
  const deal = await getDealByIdForCreator(
    creatorId!,
    context.req.param("dealId"),
  );
  return deal
    ? context.json(deal satisfies ApiDeal)
    : context.json({ error: "Not found" }, 404);
});

deals.post("/", async (context) => {
  const parsed = createDealRequestSchema.safeParse(await parseBody(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 400);
  const { creatorId } = getAuthContext(context);
  const mapped = mapDealBody(parsed.data);
  const created = await createDeal({
    ...mapped,
    creator_id: creatorId!,
    brand_name: parsed.data.brandName,
  });
  return context.json(created satisfies ApiDeal, 201);
});

deals.patch("/:dealId", async (context) => {
  const parsed = updateDealRequestSchema.safeParse(await parseBody(context));
  if (!parsed.success) return context.json(validationError(parsed.error), 400);
  const { creatorId } = getAuthContext(context);
  const updated = await updateDeal(
    creatorId!,
    context.req.param("dealId"),
    mapDealBody(parsed.data),
  );
  if (!updated) return context.json({ error: "Not found" }, 404);
  return context.json(updated satisfies ApiDeal);
});

deals.patch("/:dealId/stage", async (context) => {
  const parsed = updateDealStageRequestSchema.safeParse(
    await parseBody(context),
  );
  if (!parsed.success) return context.json(validationError(parsed.error), 400);
  const { creatorId } = getAuthContext(context);
  const updated = await updateDealStage(
    creatorId!,
    context.req.param("dealId"),
    parsed.data.stage,
  );
  if (!updated) return context.json({ error: "Not found" }, 404);
  return context.json(updated satisfies ApiDeal);
});
