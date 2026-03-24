import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import pino from "pino";
import { generateRevenueReport } from "../../agent/skills/revenue-advisor.js";
import { generateContentStrategy } from "../../agent/skills/content-strategy.js";
import { generateFinancialSnapshot } from "../../agent/skills/financial-tracker.js";
import { aggregateAnalytics } from "../../agent/skills/analytics-aggregator.js";
import { analyzeSeo } from "../../agent/skills/seo-optimizer.js";
import { getCalendarView } from "../../agent/skills/calendar-manager.js";
import { triageMessages } from "../../agent/skills/inbox-triager.js";
import { getAuthContext, requireCreatorAuth } from "../middleware/auth.js";

const log = pino({ name: "api:reports" });

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
    return c.json(snapshot);
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
    return c.json(analytics);
  } catch (err: unknown) {
    log.error({ creatorId, error: errMsg(err) }, "Analytics aggregation failed");
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

  let body: { messages?: unknown };
  try {
    body = await c.req.json<{ messages?: unknown }>();
  } catch {
    throw new HTTPException(400, { message: "Request body must be valid JSON" });
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return c.json({ error: "messages array is required" }, 400);
  }

  const messages = body.messages as Array<{ from: string; text: string; platform?: string }>;

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
  let body: { platform?: string; title?: string; description?: string; tags?: string[]; niche?: string };
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Request body must be valid JSON" });
  }

  if (!body.platform) {
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
