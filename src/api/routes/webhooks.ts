import { Hono } from "hono";
import { Bot, webhookCallback } from "grammy";
import crypto from "node:crypto";
import {
  handleWhatsAppWebhookPayload,
  sendWhatsAppMessage,
  verifyWhatsAppSignature,
  verifyWhatsAppWebhook,
} from "../../bot/whatsapp.js";
import pino from "pino";

const log = pino({ name: "routes:webhooks" });

type TelegramMode = "disabled" | "polling" | "webhook";

type WebhookRouteOptions = {
  telegramMode?: TelegramMode;
  telegramBot?: Bot | null;
  telegramWebhookSecret?: string;
  telegramHandler?: ReturnType<typeof webhookCallback>;
};

function secretsMatch(expected: string, supplied: string | undefined) {
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export function createWebhookRoutes(options: WebhookRouteOptions = {}) {
  const routes = new Hono();
  const telegramMode = options.telegramMode ?? "disabled";

  routes.post("/telegram", async (context) => {
    if (telegramMode !== "webhook") {
      return context.text("Telegram webhook mode is disabled", 404);
    }

    if (!options.telegramBot) {
      log.warn("Telegram webhook received but no bot is registered");
      return context.text("Bot not configured", 503);
    }

    const suppliedSecret = context.req.header(
      "X-Telegram-Bot-Api-Secret-Token",
    );
    if (!secretsMatch(options.telegramWebhookSecret ?? "", suppliedSecret)) {
      return context.text("Unauthorized", 401);
    }

    try {
      if (options.telegramHandler) {
        return await options.telegramHandler(context as never);
      }
      return await webhookCallback(options.telegramBot, "hono")(context);
    } catch (error) {
      log.error({ error }, "Telegram webhook handler failed");
      return context.text("OK", 200); // Avoid retries after authenticated processing fails.
    }
  });

  routes.get("/whatsapp", (context) => {
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

  routes.post("/whatsapp", async (context) => {
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

  return routes;
}

export const webhooks = createWebhookRoutes();
