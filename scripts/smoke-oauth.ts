import { pathToFileURL } from "node:url";

export async function runOAuthSmoke(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const apiBase = env.SMOKE_API_URL?.trim() || env.NEXT_PUBLIC_API_URL?.trim();
  const token = env.SMOKE_PRIVY_ACCESS_TOKEN?.trim();
  if (!apiBase) throw new Error("SMOKE_API_URL is required for OAuth smoke");
  if (!token)
    throw new Error("SMOKE_PRIVY_ACCESS_TOKEN is required for OAuth smoke");
  const response = await fetch(
    new URL("/api/platforms/oauth/youtube/start", apiBase),
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      redirect: "manual",
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    url?: string;
    error?: { message?: string } | string;
  } | null;
  if (!response.ok || !payload?.url) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : (payload?.error?.message ?? `HTTP ${response.status}`);
    throw new Error(`YouTube OAuth start failed: ${message}`);
  }
  const authorization = new URL(payload.url);
  if (
    authorization.protocol !== "https:" ||
    authorization.hostname !== "accounts.google.com"
  )
    throw new Error(
      "OAuth authorization URL is not the expected Google HTTPS origin",
    );
  if (!authorization.searchParams.get("state"))
    throw new Error("OAuth authorization URL is missing signed state");
  console.log("OK    YouTube OAuth start URL, HTTPS origin, and signed state");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runOAuthSmoke().catch((error) => {
    console.error(
      `OAuth smoke failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exit(1);
  });
}
