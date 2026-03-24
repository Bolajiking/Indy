import { Hono } from "hono";
import { supabase } from "../../db/client.js";
import pino from "pino";

const log = pino({ name: "api:health" });

export const health = new Hono();

const startedAt = Date.now();

health.get("/", async (c) => {
  const checks: Record<string, string> = {};

  // Supabase check
  try {
    const { error } = await supabase.from("creators").select("id").limit(1);
    checks.database = error ? `error: ${error.message}` : "ok";
  } catch {
    checks.database = "unreachable";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return c.json({
    status: allOk ? "ok" : "degraded",
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    checks,
  }, allOk ? 200 : 503);
});

health.get("/ready", async (c) => {
  try {
    const { error } = await supabase.from("creators").select("id").limit(1);
    if (error) {
      return c.json({ ready: false, reason: error.message }, 503);
    }
    return c.json({ ready: true }, 200);
  } catch {
    return c.json({ ready: false, reason: "database unreachable" }, 503);
  }
});
