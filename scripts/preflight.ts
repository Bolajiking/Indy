import { lookup } from "node:dns/promises";
import { URL } from "node:url";
import { env } from "../src/config/env.js";

type CheckResult = {
  name: string;
  ok: boolean;
  level: "ok" | "warn" | "fail";
  detail: string;
};

async function checkDns(host: string, label: string): Promise<CheckResult> {
  try {
    const resolved = await lookup(host);
    return {
      name: label,
      ok: true,
      level: "ok",
      detail: `${host} resolves to ${resolved.address}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown DNS error";
    return {
      name: label,
      ok: false,
      level: "fail",
      detail: `${host} lookup failed: ${message}`,
    };
  }
}

function checkValue(name: string, value: string | boolean): CheckResult {
  const ok = typeof value === "boolean" ? true : value.trim().length > 0;
  return {
    name,
    ok,
    level: ok ? "ok" : "fail",
    detail:
      typeof value === "boolean"
        ? String(value)
        : ok
          ? "configured"
          : "missing",
  };
}

function checkGroupedValues(
  label: string,
  fields: Array<{ name: string; value: string }>,
  options?: { optional?: boolean; note?: string }
): CheckResult {
  const missing = fields.filter((field) => field.value.trim().length === 0).map((field) => field.name);

  if (missing.length === 0) {
    return {
      name: label,
      ok: true,
      level: "ok",
      detail: "configured",
    };
  }

  if (missing.length === fields.length && options?.optional) {
    return {
      name: label,
      ok: true,
      level: "warn",
      detail: `not configured${options.note ? ` (${options.note})` : ""}`,
    };
  }

  return {
    name: label,
    ok: false,
    level: "fail",
    detail: `missing ${missing.join(", ")}${options?.note ? ` (${options.note})` : ""}`,
  };
}

async function main() {
  const supabaseHost = new URL(env.SUPABASE_URL).hostname;

  const checks: CheckResult[] = [
    checkValue("ANTHROPIC_API_KEY", env.ANTHROPIC_API_KEY),
    checkValue("SUPABASE_URL", env.SUPABASE_URL),
    checkValue("SUPABASE_SERVICE_KEY", env.SUPABASE_SERVICE_KEY),
    checkValue("PRIVY_APP_ID", env.PRIVY_APP_ID),
    checkValue("PRIVY_APP_SECRET", env.PRIVY_APP_SECRET),
    checkValue("PRIVY_JWT_VERIFICATION_KEY", env.PRIVY_JWT_VERIFICATION_KEY),
    checkValue("TELEGRAM_BOT_TOKEN", env.TELEGRAM_BOT_TOKEN),
    checkValue("ENABLE_TELEGRAM_BOT", env.ENABLE_TELEGRAM_BOT),
    checkValue("ENABLE_JOBS", env.ENABLE_JOBS),
    checkGroupedValues(
      "YouTube OAuth env",
      [
        { name: "GOOGLE_OAUTH_CLIENT_ID", value: env.GOOGLE_OAUTH_CLIENT_ID },
        { name: "GOOGLE_OAUTH_CLIENT_SECRET", value: env.GOOGLE_OAUTH_CLIENT_SECRET },
        { name: "YOUTUBE_OAUTH_REDIRECT_URI", value: env.YOUTUBE_OAUTH_REDIRECT_URI },
        { name: "DASHBOARD_APP_URL", value: env.DASHBOARD_APP_URL },
      ],
      {
        optional: true,
        note: "needed for live YouTube OAuth smoke",
      }
    ),
    checkGroupedValues(
      "Dashboard public env",
      [
        { name: "NEXT_PUBLIC_PRIVY_APP_ID", value: process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() ?? "" },
        {
          name: "NEXT_PUBLIC_PRIVY_CLIENT_ID",
          value: process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID?.trim() ?? "",
        },
        { name: "NEXT_PUBLIC_API_URL", value: process.env.NEXT_PUBLIC_API_URL?.trim() ?? "" },
      ],
      {
        optional: true,
        note: "needed when running or building dashboard directly",
      }
    ),
    await checkDns(supabaseHost, "Supabase DNS"),
    await checkDns("api.telegram.org", "Telegram DNS"),
    await checkDns("stableenrich.dev", "MPP provider DNS"),
  ];

  console.log("Indyfren preflight");
  for (const check of checks) {
    const status =
      check.level === "warn" ? "WARN" : check.ok ? "OK" : "FAIL";
    console.log(`${status}  ${check.name}: ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  const warned = checks.filter((check) => check.level === "warn");
  if (failed.length > 0) {
    console.log(`\n${failed.length} check(s) need attention before live smoke tests.`);
    process.exitCode = 1;
    return;
  }

  if (warned.length > 0) {
    console.log(`\n${warned.length} optional readiness check(s) are not configured yet.`);
  }

  console.log("\nAll preflight checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
