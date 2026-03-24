import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findService, listServices, registerService } from "../../../src/agent/tools/x402-registry.js";

describe("x402ServiceRegistry", () => {
  beforeEach(() => {
    delete process.env.AGENTCASH_BAZAAR_URL;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete process.env.AGENTCASH_BAZAAR_URL;
  });

  describe("findService", () => {
    it("returns a static service entry for known capabilities", async () => {
      const service = await findService("brand_enrichment");
      expect(service).not.toBeNull();
      expect(service!.name).toBe("StableEnrich");
      expect(service!.url).toContain("stableenrich.com");
      expect(service!.estimatedCostCents).toBeGreaterThan(0);
      expect(service!.source).toBe("static");
    });

    it("returns browser service", async () => {
      const service = await findService("browser");
      expect(service).not.toBeNull();
      expect(service!.name).toBe("Browserbase");
    });

    it("returns null for unknown capability", async () => {
      const service = await findService("unknown_capability_xyz");
      expect(service).toBeNull();
    });

    it("falls back to static registry when bazaar is unreachable", async () => {
      process.env.AGENTCASH_BAZAAR_URL = "http://nonexistent-bazaar.example.com";

      vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const service = await findService("web_search");
      expect(service).not.toBeNull();
      expect(service!.source).toBe("static");
    });

    it("uses bazaar result when bazaar is available", async () => {
      process.env.AGENTCASH_BAZAAR_URL = "http://bazaar.example.com";

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          services: [
            {
              capability: "web_search",
              name: "Premium Search",
              endpoint: "https://premium-search.example.com/v1/search",
              max_price_cents: 5,
              description: "High quality search results",
            },
          ],
        }),
      } as Response);

      const service = await findService("web_search");
      expect(service).not.toBeNull();
      expect(service!.name).toBe("Premium Search");
      expect(service!.source).toBe("bazaar");
    });
  });

  describe("listServices", () => {
    it("returns all static services when no capability filter", async () => {
      const services = await listServices();
      expect(services.length).toBeGreaterThan(3);
      const capabilities = services.map((s) => s.capability);
      expect(capabilities).toContain("brand_enrichment");
      expect(capabilities).toContain("browser");
      expect(capabilities).toContain("web_search");
    });

    it("returns filtered services when capability specified", async () => {
      const services = await listServices("brand_enrichment");
      expect(services).toHaveLength(1);
      expect(services[0].capability).toBe("brand_enrichment");
    });
  });

  describe("registerService", () => {
    it("registers a new service and makes it discoverable", async () => {
      registerService({
        capability: "test_capability_unique",
        name: "Test Service",
        url: "https://test.example.com/api",
        estimatedCostCents: 10,
        description: "A test service",
        source: "static",
      });

      const service = await findService("test_capability_unique");
      expect(service).not.toBeNull();
      expect(service!.name).toBe("Test Service");
    });
  });
});
