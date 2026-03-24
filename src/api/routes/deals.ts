import { Hono } from "hono";
import { getDealByIdForCreator, getDealsForCreator, updateDealStage } from "../../db/queries/deals.js";
import type { DealStage } from "../../config/constants.js";
import { getAuthContext, requireCreatorAuth } from "../middleware/auth.js";

export const deals = new Hono();

deals.use("*", requireCreatorAuth);

deals.get("/", async (context) => {
  const { creatorId } = getAuthContext(context);
  const stage = context.req.query("stage") as DealStage | undefined;
  const result = await getDealsForCreator(creatorId!, stage);
  return context.json(result);
});

deals.get("/:dealId", async (context) => {
  const { creatorId } = getAuthContext(context);
  const deal = await getDealByIdForCreator(creatorId!, context.req.param("dealId"));
  if (!deal) {
    return context.json({ error: "Not found" }, 404);
  }

  return context.json(deal);
});

deals.patch("/:dealId/stage", async (context) => {
  const { creatorId } = getAuthContext(context);
  const dealId = context.req.param("dealId");

  // Verify ownership before mutating
  const existing = await getDealByIdForCreator(creatorId!, dealId);
  if (!existing) {
    return context.json({ error: "Not found" }, 404);
  }

  const body = await context.req.json<{ stage: DealStage }>();
  if (!body.stage) {
    return context.json({ error: "stage is required" }, 400);
  }

  const updated = await updateDealStage(dealId, body.stage);
  return context.json(updated);
});
