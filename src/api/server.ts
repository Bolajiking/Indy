import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface ApiServerOptions {
  allowedOrigins?: string[];
  maxBodyBytes?: number;
  rateLimit?: RateLimitOptions;
}

const DEFAULT_MAX_BODY_BYTES = 1_000_000;
const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  windowMs: 60_000,
  maxRequests: 120,
};

function getDefaultAllowedOrigins(): string[] {
  return [
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    process.env.DASHBOARD_APP_URL,
  ].filter((origin): origin is string => Boolean(origin));
}

function getClientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export function createApiServer(options: ApiServerOptions = {}) {
  const app = new Hono();
  const allowedOrigins = new Set(
    options.allowedOrigins ?? getDefaultAllowedOrigins(),
  );
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const rateLimit = options.rateLimit ?? DEFAULT_RATE_LIMIT;
  const requestBuckets = new Map<string, { count: number; resetAt: number }>();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: (origin) => (allowedOrigins.has(origin) ? origin : undefined),
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  );
  app.use("*", async (context, next) => {
    const rawContentLength = context.req.header("Content-Length");
    const contentLength = rawContentLength ? Number(rawContentLength) : 0;
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
      return context.json({ error: "Request body too large" }, 413);
    }

    const now = Date.now();
    const key = getClientKey(context.req.raw);
    const bucket = requestBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      requestBuckets.set(key, { count: 1, resetAt: now + rateLimit.windowMs });
    } else {
      bucket.count += 1;
      if (bucket.count > rateLimit.maxRequests) {
        return context.json({ error: "Too many requests" }, 429);
      }
    }

    await next();
  });

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
    }),
  );

  return app;
}
