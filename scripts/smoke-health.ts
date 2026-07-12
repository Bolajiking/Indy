import { pathToFileURL } from "node:url";

export interface HealthSmokeEnv {
  smokeApiUrl?: string;
  publicApiUrl?: string;
  port?: number;
  smokeDashboardUrl?: string;
  dashboardAppUrl?: string;
  requireDashboard?: boolean;
}

export interface HealthSmokeConfig {
  apiHealthUrl: string;
  apiReadyUrl: string;
  dashboardUrl: string | null;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function resolveHealthSmokeConfig(
  env: HealthSmokeEnv,
): HealthSmokeConfig {
  const apiBase = normalizeBaseUrl(
    env.smokeApiUrl?.trim() ||
      env.publicApiUrl?.trim() ||
      `http://localhost:${env.port ?? 3000}`,
  );
  const dashboardBase =
    env.smokeDashboardUrl?.trim() || env.dashboardAppUrl?.trim() || "";

  if (env.requireDashboard && !dashboardBase) {
    throw new Error(
      "SMOKE_REQUIRE_DASHBOARD=true requires SMOKE_DASHBOARD_URL or DASHBOARD_APP_URL",
    );
  }

  return {
    apiHealthUrl: new URL("health", apiBase).toString(),
    apiReadyUrl: new URL("health/ready", apiBase).toString(),
    dashboardUrl: dashboardBase ? normalizeBaseUrl(dashboardBase) : null,
  };
}

export function isHealthyHttpStatus(status: number): boolean {
  return status >= 200 && status < 400;
}

async function checkUrl(label: string, url: string): Promise<boolean> {
  const response = await fetch(url, { cache: "no-store" });
  const ok = isHealthyHttpStatus(response.status);
  console.log(`${ok ? "OK" : "FAIL"}  ${label}: ${url} (${response.status})`);
  return ok;
}

async function checkReadiness(url: string): Promise<boolean> {
  const response = await fetch(url, { cache: "no-store" });
  const body = (await response.json().catch(() => null)) as {
    ready?: boolean;
    checks?: Record<string, string>;
  } | null;
  const ok =
    response.ok &&
    body?.ready === true &&
    body.checks !== undefined &&
    Object.values(body.checks).every((status) => status === "ok");
  console.log(
    `${ok ? "OK" : "FAIL"}  API readiness: ${url} (${response.status})`,
  );
  return ok;
}

async function runHealthSmoke(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const config = resolveHealthSmokeConfig({
    smokeApiUrl: env.SMOKE_API_URL,
    publicApiUrl: env.NEXT_PUBLIC_API_URL,
    port: env.PORT ? Number(env.PORT) : 3000,
    smokeDashboardUrl: env.SMOKE_DASHBOARD_URL,
    dashboardAppUrl: env.DASHBOARD_APP_URL,
    requireDashboard: env.SMOKE_REQUIRE_DASHBOARD?.toLowerCase() === "true",
  });

  const checks = [
    await checkUrl("API health", config.apiHealthUrl),
    await checkReadiness(config.apiReadyUrl),
  ];

  if (config.dashboardUrl) {
    checks.push(await checkUrl("Dashboard", config.dashboardUrl));
  }

  if (checks.some((ok) => !ok)) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runHealthSmoke().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
