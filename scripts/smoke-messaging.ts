import { pathToFileURL } from "node:url";

function requireValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for messaging smoke`);
  return value;
}

async function checkTelegram(): Promise<void> {
  const token = requireValue("TELEGRAM_BOT_TOKEN");
  const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const payload = (await response.json()) as { ok?: boolean };
  if (!response.ok || payload.ok !== true)
    throw new Error(`Telegram check failed with HTTP ${response.status}`);
  console.log("OK    Telegram bot credentials and provider reachability");
}

async function checkWhatsApp(): Promise<void> {
  const phoneId = requireValue("WHATSAPP_PHONE_NUMBER_ID");
  const token = requireValue("WHATSAPP_ACCESS_TOKEN");
  const response = await fetch(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneId)}?fields=id`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok)
    throw new Error(`WhatsApp check failed with HTTP ${response.status}`);
  console.log("OK    WhatsApp credentials and provider reachability");
}

export async function runMessagingSmoke(): Promise<void> {
  const checks: Promise<void>[] = [];
  if (process.env.ENABLE_TELEGRAM_BOT?.toLowerCase() === "true")
    checks.push(checkTelegram());
  if (process.env.ENABLE_WHATSAPP?.toLowerCase() === "true")
    checks.push(checkWhatsApp());
  if (checks.length === 0)
    throw new Error("Enable at least one messaging provider for staging smoke");
  await Promise.all(checks);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runMessagingSmoke().catch((error) => {
    console.error(
      `Messaging smoke failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    process.exit(1);
  });
}
