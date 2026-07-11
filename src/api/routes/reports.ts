import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import pino from "#logger";
import { generateRevenueReport } from "../../agent/skills/revenue-advisor.js";
import { generateContentStrategy } from "../../agent/skills/content-strategy.js";
import { generateFinancialSnapshot } from "../../agent/skills/financial-tracker.js";
import { aggregateAnalytics } from "../../agent/skills/analytics-aggregator.js";
import { analyzeSeo } from "../../agent/skills/seo-optimizer.js";
import { getCalendarView } from "../../agent/skills/calendar-manager.js";
import { triageMessages } from "../../agent/skills/inbox-triager.js";
import { getAuthContext, requireCreatorAuth } from "../middleware/auth.js";
import { isRecord } from "../../db/json.js";
import { errMsg } from "../../lib/errors.js";
import type {
  ApiAggregatedAnalytics,
  ApiFinancialSnapshot,
} from "../contracts.js";

const log = pino({ name: "api:reports" });

type TriageMessageInput = {
  from: string;
  text: string;
  platform?: string;
};

type SeoReportInput = {
  platform: string;
  title?: string;
  description?: string;
  tags?: string[];
  niche?: string;
};

function isTriageMessageInput(value: unknown): value is TriageMessageInput {
  return (
    isRecord(value) &&
    typeof value.from === "string" &&
    typeof value.text === "string" &&
    (value.platform === undefined || typeof value.platform === "string")
  );
}

function isSeoReportInput(value: unknown): value is SeoReportInput {
  return (
    isRecord(value) &&
    typeof value.platform === "string" &&
    (value.title === undefined || typeof value.title === "string") &&
    (value.description === undefined ||
      typeof value.description === "string") &&
    (value.tags === undefined ||
      (Array.isArray(value.tags) &&
        value.tags.every((tag) => typeof tag === "string"))) &&
    (value.niche === undefined || typeof value.niche === "string")
  );
}

export const reports = new Hono();
reports.use("*", requireCreatorAuth);

/**
 * GET /reports/revenue — Revenue diversification report.
 */
reports.get("/revenue", async (c) => {
  const { creatorId } = getAuthContext(c);
  try {
    const report = await generateRevenueReport(creatorId!);
    return c.json(report);
  } catch (err: unknown) {
    log.error({ creatorId, error: errMsg(err) }, "Revenue report failed");
    return c.json({ error: "Failed to generate revenue report" }, 500);
  }
});

/**
 * GET /reports/financial — Financial snapshot.
 */
reports.get("/financial", async (c) => {
  const { creatorId } = getAuthContext(c);
  try {
    const snapshot = await generateFinancialSnapshot(creatorId!);
    return c.json(snapshot satisfies ApiFinancialSnapshot);
  } catch (err: unknown) {
    log.error({ creatorId, error: errMsg(err) }, "Financial snapshot failed");
    return c.json({ error: "Failed to generate financial snapshot" }, 500);
  }
});

/**
 * GET /reports/content-strategy — Content strategy report.
 */
reports.get("/content-strategy", async (c) => {
  const { creatorId } = getAuthContext(c);
  try {
    const strategy = await generateContentStrategy(creatorId!);
    return c.json(strategy);
  } catch (err: unknown) {
    log.error({ creatorId, error: errMsg(err) }, "Content strategy failed");
    return c.json({ error: "Failed to generate content strategy" }, 500);
  }
});

/**
 * GET /reports/analytics — Aggregated platform analytics.
 */
reports.get("/analytics", async (c) => {
  const { creatorId } = getAuthContext(c);
  try {
    const analytics = await aggregateAnalytics(creatorId!);
    return c.json(analytics satisfies ApiAggregatedAnalytics);
  } catch (err: unknown) {
    log.error(
      { creatorId, error: errMsg(err) },
      "Analytics aggregation failed",
    );
    return c.json({ error: "Failed to aggregate analytics" }, 500);
  }
});

/**
 * GET /reports/calendar — Calendar view of upcoming deadlines.
 */
reports.get("/calendar", async (c) => {
  const { creatorId } = getAuthContext(c);
  try {
    const calendar = await getCalendarView(creatorId!);
    return c.json(calendar);
  } catch (err: unknown) {
    log.error({ creatorId, error: errMsg(err) }, "Calendar view failed");
    return c.json({ error: "Failed to generate calendar view" }, 500);
  }
});

/**
 * POST /reports/triage — Triage incoming messages.
 * Body: { messages: [{ from, text, platform? }] }
 */
reports.post("/triage", async (c) => {
  const { creatorId } = getAuthContext(c);

  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    throw new HTTPException(400, {
      message: "Request body must be valid JSON",
    });
  }

  if (!isRecord(body) || !Array.isArray(body.messages)) {
    return c.json({ error: "messages array is required" }, 400);
  }

  if (!body.messages.every(isTriageMessageInput)) {
    return c.json({ error: "messages must include from and text" }, 400);
  }

  const messages = body.messages;

  try {
    const result = await triageMessages(creatorId!, messages);
    return c.json(result);
  } catch (err: unknown) {
    log.error({ creatorId, error: errMsg(err) }, "Inbox triage failed");
    return c.json({ error: "Failed to triage messages" }, 500);
  }
});

/**
 * POST /reports/seo — SEO analysis for content.
 * Body: { platform, title?, description?, tags?, niche? }
 */
reports.post("/seo", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json<unknown>();
  } catch {
    throw new HTTPException(400, {
      message: "Request body must be valid JSON",
    });
  }

  if (!isSeoReportInput(body)) {
    return c.json({ error: "platform is required" }, 400);
  }

  try {
    const analysis = await analyzeSeo(body.platform, body);
    return c.json(analysis);
  } catch (err: unknown) {
    log.error({ error: errMsg(err) }, "SEO analysis failed");
    return c.json({ error: "Failed to run SEO analysis" }, 500);
  }
});
