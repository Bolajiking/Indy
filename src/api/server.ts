import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";

export function createApiServer() {
  const app = new Hono();

  app.use("*", logger());
  app.use("*", cors());

  app.onError((error, context) => {
    if (error instanceof HTTPException) {
      return context.json({ error: error.message }, error.status);
    }

    return context.json({ error: "Internal server error" }, 500);
  });

  app.get("/health", (context) =>
    context.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    })
  );

  return app;
}
