import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/client.js", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { createHealthRoutes } from "../../../src/api/routes/health.js";

describe("health routes", () => {
  it("keeps liveness cheap without checking dependencies", async () => {
    const checkDatabase = vi.fn().mockRejectedValue(new Error("database down"));
    const checkRateLimit = vi.fn().mockRejectedValue(new Error("redis down"));
    const app = createHealthRoutes({ checkDatabase, checkRateLimit });

    const response = await app.request("/");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok" });
    expect(checkDatabase).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
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
