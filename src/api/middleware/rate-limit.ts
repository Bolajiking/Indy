import { createHash } from "node:crypto";
import type { Context, Hono, MiddlewareHandler } from "hono";
import pino from "pino";
import {
  InMemoryRateLimitStore,
  type RateLimitStore,
} from "../rate-limit-store.js";
import { getRequiredCreatorId, requireCreatorAuth } from "./auth.js";

const log = pino({ name: "api:rate-limit" });

export interface RateLimitPolicy {
  name: string;
  limit: number;
  windowMs: number;
  /** Expensive and mutating operations must reject requests when Redis fails. */
  failClosed: boolean;
}

export const RATE_LIMIT_POLICIES = {
  health: {
    name: "anonymous-health",
    limit: 600,
    windowMs: 60_000,
    failClosed: false,
  },
  anonymous: {
    name: "anonymous",
    limit: 120,
    windowMs: 60_000,
    failClosed: false,
  },
  authStart: {
    name: "anonymous-auth-start",
    limit: 10,
    windowMs: 60_000,
    failClosed: true,
  },
  creatorRead: {
    name: "creator-read",
    limit: 240,
    windowMs: 60_000,
    failClosed: false,
  },
  creatorWrite: {
    name: "creator-write",
    limit: 60,
    windowMs: 60_000,
    failClosed: true,
  },
  agentMessage: {
    name: "creator-agent-message",
    limit: 12,
    windowMs: 60_000,
    failClosed: true,
  },
  reportGeneration: {
    name: "creator-report-generation",
    limit: 10,
    windowMs: 60_000,
    failClosed: true,
  },
  sensitiveWrite: {
    name: "creator-sensitive-write",
    limit: 20,
    windowMs: 60_000,
    failClosed: true,
  },
} as const satisfies Record<string, RateLimitPolicy>;

export interface NetworkIdentityInput {
  socketAddress?: string;
  forwardedFor?: string;
  trustedProxyHops: number;
}

/**
 * Forwarded addresses are ignored unless the directly connected proxy is
 * trusted. Each configured hop moves one address left from the right edge.
 */
export function resolveNetworkIdentity({
  socketAddress,
  forwardedFor,
  trustedProxyHops,
}: NetworkIdentityInput): string {
  const socket = socketAddress?.trim() || "unknown";
  if (trustedProxyHops <= 0 || !forwardedFor) return socket;

  const forwarded = forwardedFor
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
  if (forwarded.length === 0) return socket;

  return forwarded[Math.max(0, forwarded.length - trustedProxyHops)] ?? socket;
}

type PolicyResolver = RateLimitPolicy | ((context: Context) => RateLimitPolicy);

interface RateLimitMiddlewareOptions {
  store: RateLimitStore;
  policy: PolicyResolver;
  key: (context: Context) => string;
  /** Bounded process-local safety net used only by explicitly cheap policies. */
  fallbackStore?: RateLimitStore;
}

function opaqueKey(policy: RateLimitPolicy, identity: string) {
  const digest = createHash("sha256").update(identity).digest("hex");
  return `indy:rate-limit:${policy.name}:${digest}`;
}

function setQuotaHeaders(
  context: Context,
  policy: RateLimitPolicy,
  count: number,
  resetAt: number,
) {
  const resetSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  context.header("RateLimit-Limit", String(policy.limit));
  context.header(
    "RateLimit-Remaining",
    String(Math.max(0, policy.limit - count)),
  );
  context.header("RateLimit-Reset", String(resetSeconds));
  return resetSeconds;
}

export function createRateLimitMiddleware(
  options: RateLimitMiddlewareOptions,
): MiddlewareHandler {
  return async (context, next) => {
    const policy =
      typeof options.policy === "function"
        ? options.policy(context)
        : options.policy;
    const key = opaqueKey(policy, options.key(context));
    let result: { count: number; resetAt: number };

    try {
      result = await options.store.increment(key, policy.windowMs);
    } catch (error) {
      if (policy.failClosed || !options.fallbackStore) {
        log.error(
          { error, policy: policy.name },
          "Rate limit store unavailable",
        );
        return context.json(
          { error: "Request throttling is temporarily unavailable" },
          503,
        );
      }

      // Cheap reads may continue only through this bounded, expiring adapter.
      result = await options.fallbackStore.increment(key, policy.windowMs);
    }

    const retryAfter = setQuotaHeaders(
      context,
      policy,
      result.count,
      result.resetAt,
    );
    if (result.count > policy.limit) {
      context.header("Retry-After", String(retryAfter));
      return context.json({ error: "Too many requests" }, 429);
    }

    await next();
  };
}

export function anonymousPolicyFor(context: Context): RateLimitPolicy {
  const path = context.req.path;
  if (path === "/health" || path.startsWith("/health/")) {
    return RATE_LIMIT_POLICIES.health;
  }
  if (
    (context.req.method === "POST" && path === "/api/auth/register") ||
    (context.req.method === "POST" && /\/oauth\/[^/]+\/start$/.test(path))
  ) {
    return RATE_LIMIT_POLICIES.authStart;
  }
  if (context.req.method !== "GET" && context.req.method !== "HEAD") {
    return { ...RATE_LIMIT_POLICIES.anonymous, failClosed: true };
  }
  return RATE_LIMIT_POLICIES.anonymous;
}

export function creatorPolicyFor(context: Context): RateLimitPolicy {
  const { method, path } = context.req;
  if (method === "POST" && path === "/api/agent/messages") {
    return RATE_LIMIT_POLICIES.agentMessage;
  }
  if (path === "/api/reports" || path.startsWith("/api/reports/")) {
    return RATE_LIMIT_POLICIES.reportGeneration;
  }
  if (
    method !== "GET" &&
    method !== "HEAD" &&
    (path.startsWith("/api/agent/approvals/") ||
      path.startsWith("/api/connections") ||
      path.startsWith("/api/platforms"))
  ) {
    return RATE_LIMIT_POLICIES.sensitiveWrite;
  }
  return method === "GET" || method === "HEAD"
    ? RATE_LIMIT_POLICIES.creatorRead
    : RATE_LIMIT_POLICIES.creatorWrite;
}

export function createBoundedFallbackStore() {
  return new InMemoryRateLimitStore({ maxEntries: 5_000 });
}

const DEFAULT_CREATOR_PATHS = [
  "/api/agent",
  "/api/deals",
  "/api/platforms",
  "/api/reports",
  "/api/wallet",
  "/api/messaging-links",
  "/api/connections",
];

interface InstallCreatorRateLimitsOptions {
  store: RateLimitStore;
  policy?: PolicyResolver;
  paths?: string[];
}

/** Installs authentication before creator-keyed quotas and mounted routers. */
export function installCreatorRateLimits(
  app: Hono,
  options: InstallCreatorRateLimitsOptions,
) {
  const limiter = createRateLimitMiddleware({
    store: options.store,
    fallbackStore: createBoundedFallbackStore(),
    policy: options.policy ?? creatorPolicyFor,
    key: (context) =>
      `creator:${getRequiredCreatorId(
        context as unknown as Parameters<typeof getRequiredCreatorId>[0],
      )}`,
  });

  for (const path of options.paths ?? DEFAULT_CREATOR_PATHS) {
    app.use(`${path}/*`, requireCreatorAuth, limiter);
  }
}
