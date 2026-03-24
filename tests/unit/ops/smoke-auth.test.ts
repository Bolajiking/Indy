import { describe, expect, it } from "vitest";
import { resolveSmokeAuthConfig } from "../../../src/ops/smoke-auth.js";

describe("resolveSmokeAuthConfig", () => {
  it("requires a Privy access token", () => {
    expect(() =>
      resolveSmokeAuthConfig({
        accessToken: "",
        smokeApiUrl: "",
        publicApiUrl: "",
        port: 3000,
        smokeDashboardUrl: "",
        defaultDashboardUrl: "",
        checkDashboardProxy: "false",
      })
    ).toThrow("SMOKE_PRIVY_ACCESS_TOKEN is required");
  });

  it("prefers the explicit smoke API url before the public API url", () => {
    const config = resolveSmokeAuthConfig({
      accessToken: "token-123",
      smokeApiUrl: "https://api.example.com/",
      publicApiUrl: "https://public.example.com",
      port: 3000,
      smokeDashboardUrl: "",
      defaultDashboardUrl: "",
      checkDashboardProxy: "false",
    });

    expect(config.apiBaseUrl).toBe("https://api.example.com");
    expect(config.dashboardProxyUrl).toBeNull();
  });

  it("falls back to localhost and opt-in dashboard proxy checks", () => {
    const config = resolveSmokeAuthConfig({
      accessToken: "token-123",
      smokeApiUrl: "",
      publicApiUrl: "",
      port: 4010,
      smokeDashboardUrl: "",
      defaultDashboardUrl: "http://localhost:3001/",
      checkDashboardProxy: "true",
    });

    expect(config.apiBaseUrl).toBe("http://localhost:4010");
    expect(config.dashboardProxyUrl).toBe(
      "http://localhost:3001/api/proxy/api/auth/me"
    );
  });

  it("fails clearly when dashboard proxy smoke is enabled without a dashboard url", () => {
    expect(() =>
      resolveSmokeAuthConfig({
        accessToken: "token-123",
        smokeApiUrl: "",
        publicApiUrl: "",
        port: 3000,
        smokeDashboardUrl: "",
        defaultDashboardUrl: "",
        checkDashboardProxy: "true",
      })
    ).toThrow(
      "SMOKE_CHECK_DASHBOARD_PROXY=true requires SMOKE_DASHBOARD_URL or DASHBOARD_APP_URL"
    );
  });
});
