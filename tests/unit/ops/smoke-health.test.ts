import { describe, expect, it } from "vitest";
import {
  isHealthyHttpStatus,
  resolveHealthSmokeConfig,
} from "../../../scripts/smoke-health.ts";

describe("health smoke config", () => {
  it("prefers an explicit smoke API url before dashboard public API env", () => {
    const config = resolveHealthSmokeConfig({
      smokeApiUrl: "https://api.indyfren.test/",
      publicApiUrl: "https://public.indyfren.test",
      port: 3000,
      smokeDashboardUrl: "",
      dashboardAppUrl: "",
      requireDashboard: false,
    });

    expect(config.apiHealthUrl).toBe("https://api.indyfren.test/health");
    expect(config.apiReadyUrl).toBe("https://api.indyfren.test/health/ready");
    expect(config.dashboardUrl).toBeNull();
  });

  it("falls back to localhost and normalizes the dashboard url", () => {
    const config = resolveHealthSmokeConfig({
      smokeApiUrl: "",
      publicApiUrl: "",
      port: 4010,
      smokeDashboardUrl: "http://localhost:3001/",
      dashboardAppUrl: "",
      requireDashboard: false,
    });

    expect(config.apiHealthUrl).toBe("http://localhost:4010/health");
    expect(config.dashboardUrl).toBe("http://localhost:3001/");
  });

  it("requires a dashboard url when dashboard health is mandatory", () => {
    expect(() =>
      resolveHealthSmokeConfig({
        smokeApiUrl: "",
        publicApiUrl: "",
        port: 3000,
        smokeDashboardUrl: "",
        dashboardAppUrl: "",
        requireDashboard: true,
      }),
    ).toThrow(
      "SMOKE_REQUIRE_DASHBOARD=true requires SMOKE_DASHBOARD_URL or DASHBOARD_APP_URL",
    );
  });

  it("accepts only 2xx and 3xx responses as healthy", () => {
    expect(isHealthyHttpStatus(200)).toBe(true);
    expect(isHealthyHttpStatus(302)).toBe(true);
    expect(isHealthyHttpStatus(404)).toBe(false);
    expect(isHealthyHttpStatus(503)).toBe(false);
  });
});
