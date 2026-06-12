import { Hono } from "hono";
import { Bot, webhookCallback } from "grammy";
import {
  handleWhatsAppWebhookPayload,
  sendWhatsAppMessage,
  verifyWhatsAppSignature,
  verifyWhatsAppWebhook,
} from "../../bot/whatsapp.js";
import pino from "pino";

const log = pino({ name: "routes:webhooks" });

export const webhooks = new Hono();

/**
 * Stores a reference to the Telegram bot for webhook mode.
 * Set via setTelegramBotForWebhook() from index.ts.
 */
let telegramBotForWebhook: Bot | null = null;

export function setTelegramBotForWebhook(bot: Bot) {
  telegramBotForWebhook = bot;
}

/**
 * POST /webhooks/telegram — Telegram webhook endpoint.
 * Alternative to long-polling. Set via Telegram Bot API setWebhook().
 */
webhooks.post("/telegram", async (c) => {
  if (!telegramBotForWebhook) {
    log.warn("Telegram webhook received but no bot is registered");
    return c.text("Bot not configured", 503);
  }

  try {
    const handler = webhookCallback(telegramBotForWebhook, "hono");
    return await handler(c);
  } catch (error) {
    log.error({ error }, "Telegram webhook handler failed");
    return c.text("OK", 200); // Always 200 to avoid Telegram retries
  }
});

webhooks.get("/whatsapp", (context) => {
  const url = new URL(context.req.url);
  const query = {
    "hub.mode": url.searchParams.get("hub.mode") ?? undefined,
    "hub.verify_token": url.searchParams.get("hub.verify_token") ?? undefined,
    "hub.challenge": url.searchParams.get("hub.challenge") ?? undefined,
  };

  const result = verifyWhatsAppWebhook(query);
  if (!result.ok) {
    return context.text("Forbidden", 403);
  }

  return context.text(result.challenge ?? "", 200);
});

webhooks.post("/whatsapp", async (context) => {
  const rawBody = await context.req.text();
  const signature = context.req.header("x-hub-signature-256");

  if (!verifyWhatsAppSignature(rawBody, signature)) {
    return context.json({ error: "Invalid WhatsApp signature" }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch (error) {
    log.warn({ error }, "WhatsApp webhook body was not valid JSON");
    return context.json({ error: "Invalid WhatsApp payload" }, 400);
  }

  const responses = await handleWhatsAppWebhookPayload(payload);

  await Promise.all(
    responses.map(({ to, response }) => sendWhatsAppMessage(to, response)),
  );

  return context.text("OK", 200);
});
