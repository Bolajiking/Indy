import { env } from "../src/config/env.js";
import { resolveSmokeAuthConfig } from "../src/ops/smoke-auth.js";

type AuthMeResponse = {
  creator: {
    id: string;
    display_name?: string | null;
    wallet_id?: string | null;
    wallet_address?: string | null;
  } | null;
  onboarding: {
    status: string;
    walletProvisioned: boolean;
  };
};

async function fetchAuthedJson<T>(
  url: string,
  accessToken: string,
): Promise<{ data: T; status: number }> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const rawBody = await response.text();

  if (!response.ok) {
    let detail = rawBody;

    try {
      const parsed = JSON.parse(rawBody) as {
        error?: string;
        message?: string;
      };
      detail = parsed.error ?? parsed.message ?? rawBody;
    } catch {
      // Preserve the raw body when the response is not JSON.
    }

    throw new Error(`HTTP ${response.status}: ${detail || "request failed"}`);
  }

  return {
    data: JSON.parse(rawBody) as T,
    status: response.status,
  };
}

function formatAuthSummary(label: string, payload: AuthMeResponse): string {
  const creator = payload.creator;

  if (!creator) {
    return `${label}: creator=unregistered onboarding=${payload.onboarding.status} wallet=${payload.onboarding.walletProvisioned ? "yes" : "no"}`;
  }

  return [
    `${label}: creator=${creator.id}`,
    `name=${creator.display_name ?? "unknown"}`,
    `onboarding=${payload.onboarding.status}`,
    `wallet=${payload.onboarding.walletProvisioned ? "yes" : "no"}`,
    `walletAddress=${creator.wallet_address ?? "pending"}`,
  ].join(" ");
}

async function main() {
  const config = resolveSmokeAuthConfig({
    accessToken: process.env.SMOKE_PRIVY_ACCESS_TOKEN?.trim() ?? "",
    smokeApiUrl: process.env.SMOKE_API_URL?.trim() ?? "",
    publicApiUrl: process.env.NEXT_PUBLIC_API_URL?.trim() ?? "",
    port: env.PORT,
    smokeDashboardUrl: process.env.SMOKE_DASHBOARD_URL?.trim() ?? "",
    defaultDashboardUrl: env.DASHBOARD_APP_URL.trim(),
    checkDashboardProxy:
      process.env.SMOKE_CHECK_DASHBOARD_PROXY?.trim() ?? "false",
  });

  console.log("Indyfren auth smoke");

  const directUrl = `${config.apiBaseUrl}/api/auth/me`;
  const direct = await fetchAuthedJson<AuthMeResponse>(
    directUrl,
    config.accessToken,
  );

  console.log(`OK    direct auth: ${direct.status} ${directUrl}`);
  console.log(formatAuthSummary("      direct", direct.data));

  if (!config.dashboardProxyUrl) {
    console.log(
      "SKIP  dashboard proxy: disabled (set SMOKE_CHECK_DASHBOARD_PROXY=true to enable)",
    );
    return;
  }

  const proxied = await fetchAuthedJson<AuthMeResponse>(
    config.dashboardProxyUrl,
    config.accessToken,
  );

  console.log(
    `OK    dashboard proxy: ${proxied.status} ${config.dashboardProxyUrl}`,
  );
  console.log(formatAuthSummary("      proxy ", proxied.data));

  const directCreatorId = direct.data.creator?.id ?? null;
  const proxiedCreatorId = proxied.data.creator?.id ?? null;
  const directStatus = direct.data.onboarding.status;
  const proxiedStatus = proxied.data.onboarding.status;

  if (directCreatorId !== proxiedCreatorId || directStatus !== proxiedStatus) {
    throw new Error(
      `Direct API and dashboard proxy disagree (direct creator=${directCreatorId ?? "none"}, proxy creator=${proxiedCreatorId ?? "none"}, direct onboarding=${directStatus}, proxy onboarding=${proxiedStatus})`,
    );
  }
}

main().catch((error) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown error while running auth smoke";
  console.error(`Auth smoke failed: ${message}`);
  process.exit(1);
});
