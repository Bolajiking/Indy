import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/auth/session.js", () => ({
  authenticateAccessToken: vi.fn(),
}));
import {
  InMemoryRateLimitStore,
  type RateLimitStore,
} from "../../../src/api/rate-limit-store.js";
import {
  anonymousPolicyFor,
  creatorPolicyFor,
  createRateLimitMiddleware,
  installCreatorRateLimits,
  resolveNetworkIdentity,
  type RateLimitPolicy,
} from "../../../src/api/middleware/rate-limit.js";
import { createApiServer } from "../../../src/api/server.js";
import { authenticateAccessToken } from "../../../src/auth/session.js";
import { requireCreatorAuth } from "../../../src/api/middleware/auth.js";

const oneRequest: RateLimitPolicy = {
  name: "test",
  limit: 1,
  windowMs: 60_000,
  failClosed: true,
};

describe("distributed API rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateAccessToken).mockResolvedValue({
      creatorId: "creator-one",
      privyUserId: "did:privy:creator-one",
    });
  });

  it("enforces anonymous quotas by socket address", async () => {
    const app = createApiServer({
      rateLimitStore: new InMemoryRateLimitStore(),
      anonymousPolicy: oneRequest,
      getSocketAddress: () => "203.0.113.10",
    });

    expect((await app.request("/health")).status).toBe(200);
    expect((await app.request("/health")).status).toBe(429);
  });

  it("cannot bypass an IP quota by rotating spoofed forwarding headers", async () => {
    const app = createApiServer({
      rateLimitStore: new InMemoryRateLimitStore(),
      anonymousPolicy: oneRequest,
      getSocketAddress: () => "203.0.113.10",
      trustedProxyHops: 0,
    });

    const first = await app.request("/health", {
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    const second = await app.request("/health", {
      headers: { "x-forwarded-for": "198.51.100.2" },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
  });

  it("uses only the configured number of trusted proxy hops", () => {
    expect(
      resolveNetworkIdentity({
        socketAddress: "10.0.0.4",
        forwardedFor: "198.51.100.20",
        trustedProxyHops: 1,
      }),
    ).toBe("198.51.100.20");
    expect(
      resolveNetworkIdentity({
        socketAddress: "10.0.0.4",
        forwardedFor: "198.51.100.99, 198.51.100.20",
        trustedProxyHops: 1,
      }),
    ).toBe("198.51.100.20");
  });

  it("assigns conservative IP policies to registration and OAuth starts", async () => {
    const app = new Hono();
    app.all("*", (c) => c.text(anonymousPolicyFor(c).name));

    expect(
      await (
        await app.request("/api/auth/register", { method: "POST" })
      ).text(),
    ).toBe("anonymous-auth-start");
    expect(
      await (
        await app.request("/api/platforms/oauth/youtube/start", {
          method: "POST",
        })
      ).text(),
    ).toBe("anonymous-auth-start");
    expect(await (await app.request("/health")).text()).toBe(
      "anonymous-health",
    );
  });

  it("assigns strict creator policies to reports, approvals, and connected-app writes", async () => {
    const app = new Hono();
    app.all("*", (c) => c.text(creatorPolicyFor(c).name));

    expect(await (await app.request("/api/reports/financial")).text()).toBe(
      "creator-report-generation",
    );
    expect(
      await (
        await app.request("/api/agent/approvals/action-1/approve", {
          method: "POST",
        })
      ).text(),
    ).toBe("creator-sensitive-write");
    expect(
      await (
        await app.request("/api/connections/gmail", { method: "DELETE" })
      ).text(),
    ).toBe("creator-sensitive-write");
  });

  it("enforces authenticated quotas by creator rather than network address", async () => {
    const app = new Hono<{ Variables: { auth: { creatorId: string } } }>();
    const store = new InMemoryRateLimitStore();
    app.use("*", async (c, next) => {
      c.set("auth", { creatorId: "creator-one" });
      await next();
    });
    app.use(
      "*",
      createRateLimitMiddleware({
        store,
        policy: oneRequest,
        key: (c) => `creator:${c.get("auth").creatorId}`,
      }),
    );
    app.get("/resource", (c) => c.json({ ok: true }));

    expect(
      (
        await app.request("/resource", {
          headers: { "x-forwarded-for": "198.51.100.1" },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request("/resource", {
          headers: { "x-forwarded-for": "198.51.100.2" },
        })
      ).status,
    ).toBe(429);
  });

  it("installs creator quotas after creator authentication", async () => {
    const app = createApiServer({
      rateLimitStore: new InMemoryRateLimitStore(),
      anonymousPolicy: { ...oneRequest, name: "outer", limit: 100 },
      getSocketAddress: () => "203.0.113.10",
    });
    installCreatorRateLimits(app, {
      store: new InMemoryRateLimitStore(),
      policy: oneRequest,
      paths: ["/api/deals"],
    });
    app.use("/api/deals/*", requireCreatorAuth);
    app.get("/api/deals", (c) => c.text("ok"));

    const request = () =>
      app.request("/api/deals", {
        headers: { Authorization: "Bearer valid-token" },
      });
    expect((await request()).status).toBe(200);
    expect(authenticateAccessToken).toHaveBeenCalledTimes(1);
    expect((await request()).status).toBe(429);
    expect(authenticateAccessToken).toHaveBeenCalledTimes(2);
  });

  it("gives agent messages a stricter creator policy than authenticated reads", async () => {
    const store = new InMemoryRateLimitStore();
    const app = new Hono();
    app.use(
      "*",
      createRateLimitMiddleware({
        store,
        policy: creatorPolicyFor,
        key: () => "creator:opaque-key",
      }),
    );
    app.on(["GET", "POST"], "/api/agent/messages", (c) => c.text("ok"));

    for (let request = 0; request < 13; request += 1) {
      expect((await app.request("/api/agent/messages")).status).toBe(200);
    }
    for (let request = 0; request < 12; request += 1) {
      expect(
        (await app.request("/api/agent/messages", { method: "POST" })).status,
      ).toBe(200);
    }
    expect(
      (await app.request("/api/agent/messages", { method: "POST" })).status,
    ).toBe(429);
  });

  it("evicts old entries when the local adapter reaches its bound", async () => {
    const store = new InMemoryRateLimitStore({ maxEntries: 1 });

    expect((await store.increment("first", 60_000)).count).toBe(1);
    expect((await store.increment("second", 60_000)).count).toBe(1);
    expect((await store.increment("first", 60_000)).count).toBe(1);
  });

  it("emits standard quota and retry headers", async () => {
    const app = createApiServer({
      rateLimitStore: new InMemoryRateLimitStore(),
      anonymousPolicy: oneRequest,
      getSocketAddress: () => "203.0.113.11",
    });

    const allowed = await app.request("/health");
    const limited = await app.request("/health");

    expect(allowed.headers.get("RateLimit-Limit")).toBe("1");
    expect(allowed.headers.get("RateLimit-Remaining")).toBe("0");
    expect(Number(allowed.headers.get("RateLimit-Reset"))).toBeGreaterThan(0);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("fails closed when the distributed store is unavailable", async () => {
    const failingStore: RateLimitStore = {
      increment: async () => {
        throw new Error("redis unavailable");
      },
    };
    const app = new Hono();
    app.use(
      "*",
      createRateLimitMiddleware({
        store: failingStore,
        policy: oneRequest,
        key: () => "creator:opaque-key",
      }),
    );
    app.post("/api/agent/messages", (c) => c.text("must not run"));

    const response = await app.request("/api/agent/messages", {
      method: "POST",
    });
    expect(response.status).toBe(503);
  });

  it("shares quotas across independent server instances", async () => {
    const store = new InMemoryRateLimitStore();
    const options = {
      rateLimitStore: store,
      anonymousPolicy: oneRequest,
      getSocketAddress: () => "203.0.113.12",
    };
    const firstServer = createApiServer(options);
    const secondServer = createApiServer(options);

    expect((await firstServer.request("/health")).status).toBe(200);
    expect((await secondServer.request("/health")).status).toBe(429);
  });
});
