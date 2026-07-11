import { Hono } from "hono";
import { supabase } from "../../db/client.js";

async function checkDatabase() {
  const { error } = await supabase.from("creators").select("id").limit(1);
  if (error) throw new Error("Database unavailable");
}

interface HealthRouteOptions {
  checkDatabase?: () => Promise<void>;
  checkRateLimit?: () => Promise<void>;
  checkQueue?: () => Promise<void>;
  isShuttingDown?: () => boolean;
}

export function createHealthRoutes(options: HealthRouteOptions = {}) {
  const app = new Hono();
  const databaseCheck = options.checkDatabase ?? checkDatabase;

  app.get("/ready", async (c) => {
    if (options.isShuttingDown?.()) {
      return c.json(
        { ready: false, checks: { runtime: "shutting_down" } },
        503,
      );
    }
    const checks: Record<string, "ok" | "unreachable"> = {};
    const dependencies: Array<[string, () => Promise<void>]> = [
      ["database", databaseCheck],
    ];
    if (options.checkRateLimit) {
      dependencies.push(["rateLimit", options.checkRateLimit]);
    }
    if (options.checkQueue) dependencies.push(["queue", options.checkQueue]);

    await Promise.all(
      dependencies.map(async ([name, check]) => {
        try {
          await check();
          checks[name] = "ok";
        } catch {
          checks[name] = "unreachable";
        }
      }),
    );
    const ready = Object.values(checks).every((status) => status === "ok");
    return c.json({ ready, checks }, ready ? 200 : 503);
  });

  return app;
}
