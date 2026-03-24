import { Hono } from "hono";
import { getDealByIdForCreator, getDealsForCreator } from "../../db/queries/deals.js";
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
