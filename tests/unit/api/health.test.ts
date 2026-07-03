import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/client.js", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { createHealthRoutes } from "../../../src/api/routes/health.js";
import { createApiServer } from "../../../src/api/server.js";
import { InMemoryRateLimitStore } from "../../../src/api/rate-limit-store.js";

describe("health routes", () => {
  it("leaves liveness ownership to the API server", async () => {
    const checkDatabase = vi.fn().mockRejectedValue(new Error("database down"));
    const checkRateLimit = vi.fn().mockRejectedValue(new Error("redis down"));
    const app = createHealthRoutes({ checkDatabase, checkRateLimit });

    const response = await app.request("/");

    expect(response.status).toBe(404);
    expect(checkDatabase).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("composes cheap liveness with dependency readiness like the production server", async () => {
    const app = createApiServer({
      rateLimitStore: new InMemoryRateLimitStore(),
      getSocketAddress: () => "203.0.113.40",
    });
    app.route(
      "/health",
      createHealthRoutes({
        checkDatabase: async () => undefined,
        checkRateLimit: async () => undefined,
      }),
    );

    const liveness = await app.request("/health");
    const readiness = await app.request("/health/ready");

    expect(liveness.status).toBe(200);
    expect(await liveness.json()).toEqual({
      status: "ok",
      timestamp: expect.any(String),
    });
    expect(readiness.status).toBe(200);
    expect(await readiness.json()).toEqual({
      ready: true,
      checks: { database: "ok", rateLimit: "ok" },
    });
  });

  it("reports distributed rate-limit Redis failures through readiness", async () => {
    const app = createHealthRoutes({
      checkDatabase: async () => undefined,
      checkRateLimit: async () => {
        throw new Error("redis unavailable with secret details");
      },
    });

    const response = await app.request("/ready");
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      ready: false,
      checks: { database: "ok", rateLimit: "unreachable" },
    });
    expect(JSON.stringify(body)).not.toContain("secret details");
  });

  it("reports readiness when all configured dependencies respond", async () => {
    const app = createHealthRoutes({
      checkDatabase: async () => undefined,
      checkRateLimit: async () => undefined,
    });

    const response = await app.request("/ready");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ready: true,
      checks: { database: "ok", rateLimit: "ok" },
    });
  });
});
