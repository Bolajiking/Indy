import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import {
  InMemoryRateLimitStore,
  type RateLimitStore,
} from "./rate-limit-store.js";
import {
  anonymousPolicyFor,
  createBoundedFallbackStore,
  createRateLimitMiddleware,
  resolveNetworkIdentity,
  type RateLimitPolicy,
} from "./middleware/rate-limit.js";

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
}

interface ApiServerOptions {
  allowedOrigins?: string[];
  maxBodyBytes?: number;
  rateLimit?: RateLimitOptions;
  rateLimitStore?: RateLimitStore;
  anonymousPolicy?: RateLimitPolicy;
  trustedProxyHops?: number;
  getSocketAddress?: (context: Context) => string | undefined;
}

const DEFAULT_MAX_BODY_BYTES = 1_000_000;
function getDefaultAllowedOrigins(): string[] {
  return [
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    process.env.DASHBOARD_APP_URL,
  ].filter((origin): origin is string => Boolean(origin));
}

function getNodeSocketAddress(context: Context): string | undefined {
  try {
    return getConnInfo(context).remote.address;
  } catch {
    return undefined;
  }
}

export function createApiServer(options: ApiServerOptions = {}) {
  const app = new Hono();
  const allowedOrigins = new Set(
    options.allowedOrigins ?? getDefaultAllowedOrigins(),
  );
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const rateLimitStore = options.rateLimitStore ?? new InMemoryRateLimitStore();
  const anonymousPolicy =
    options.anonymousPolicy ??
    (options.rateLimit
      ? {
          name: "anonymous",
          limit: options.rateLimit.maxRequests,
          windowMs: options.rateLimit.windowMs,
          failClosed: true,
        }
      : undefined);
  const getSocketAddress = options.getSocketAddress ?? getNodeSocketAddress;
  const trustedProxyHops = options.trustedProxyHops ?? 0;
  const fallbackStore = createBoundedFallbackStore();

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

    await next();
  });
  app.use(
    "*",
    createRateLimitMiddleware({
      store: rateLimitStore,
      fallbackStore,
      policy: anonymousPolicy ?? anonymousPolicyFor,
      key: (context) =>
        `ip:${resolveNetworkIdentity({
          socketAddress: getSocketAddress(context),
          forwardedFor: context.req.header("x-forwarded-for"),
          trustedProxyHops,
        })}`,
    }),
  );

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
