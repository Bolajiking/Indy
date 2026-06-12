export interface ResolveSmokeAuthConfigInput {
  accessToken: string;
  smokeApiUrl: string;
  publicApiUrl: string;
  port: number;
  smokeDashboardUrl: string;
  defaultDashboardUrl: string;
  checkDashboardProxy: string;
}

export interface SmokeAuthConfig {
  accessToken: string;
  apiBaseUrl: string;
  dashboardProxyUrl: string | null;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isEnabled(value: string): boolean {
  return value.trim().toLowerCase() === "true";
}

export function resolveSmokeAuthConfig(
  input: ResolveSmokeAuthConfigInput,
): SmokeAuthConfig {
  const accessToken = input.accessToken.trim();
  if (!accessToken) {
    throw new Error(
      "SMOKE_PRIVY_ACCESS_TOKEN is required. Use a real Privy access token from a signed-in dashboard session.",
    );
  }

  const apiBaseUrl = normalizeBaseUrl(
    input.smokeApiUrl || input.publicApiUrl || `http://localhost:${input.port}`,
  );

  const dashboardBaseUrl = normalizeBaseUrl(
    input.smokeDashboardUrl || input.defaultDashboardUrl,
  );

  if (isEnabled(input.checkDashboardProxy)) {
    if (!dashboardBaseUrl) {
      throw new Error(
        "SMOKE_CHECK_DASHBOARD_PROXY=true requires SMOKE_DASHBOARD_URL or DASHBOARD_APP_URL.",
      );
    }

    return {
      accessToken,
      apiBaseUrl,
      dashboardProxyUrl: `${dashboardBaseUrl}/api/proxy/api/auth/me`,
    };
  }

  return {
    accessToken,
    apiBaseUrl,
    dashboardProxyUrl: null,
  };
}
