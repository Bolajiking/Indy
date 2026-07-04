import { Hono } from "hono";
import type { Bot } from "grammy";
import crypto from "node:crypto";
import {
  verifyWhatsAppSignature,
  verifyWhatsAppWebhook,
} from "../../bot/whatsapp.js";
import pino from "pino";
import type {
  ClaimWebhookEventInput,
  WebhookEventClaim,
} from "../../db/queries/webhook-events.js";
import type { WebhookDeliveryData } from "../../jobs/webhook-delivery.js";

const log = pino({ name: "routes:webhooks" });

type TelegramMode = "disabled" | "polling" | "webhook";

type WebhookRouteOptions = {
  telegramMode?: TelegramMode;
  telegramBot?: Bot | null;
  telegramWebhookSecret?: string;
  whatsappEnabled?: boolean;
  whatsappVerifyToken?: string;
  whatsappWebhookSecret?: string;
  claimWebhookEvent?: (
    input: ClaimWebhookEventInput,
  ) => Promise<WebhookEventClaim>;
  enqueueWebhook?: (data: WebhookDeliveryData) => Promise<void>;
};

const processableTelegramKeys = new Set([
  "message",
  "edited_message",
  "channel_post",
  "edited_channel_post",
  "inline_query",
  "chosen_inline_result",
  "callback_query",
  "shipping_query",
  "pre_checkout_query",
  "poll",
  "poll_answer",
  "my_chat_member",
  "chat_member",
  "chat_join_request",
  "message_reaction",
  "message_reaction_count",
  "chat_boost",
  "removed_chat_boost",
  "business_connection",
  "business_message",
  "edited_business_message",
  "deleted_business_messages",
  "purchased_paid_media",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getTelegramProviderEventId(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  const updateId = payload.update_id;
  return Number.isSafeInteger(updateId) ? String(updateId) : null;
}

export function isProcessableTelegramEvent(payload: unknown): boolean {
  return (
    isRecord(payload) &&
    Object.keys(payload).some((key) => processableTelegramKeys.has(key))
  );
}

export function getWhatsAppProviderEventIds(payload: unknown): {
  ids: string[];
  hasMessages: boolean;
  missingId: boolean;
} {
  if (!isRecord(payload) || !Array.isArray(payload.entry)) {
    return { ids: [], hasMessages: false, missingId: false };
  }
  const ids: string[] = [];
  let hasMessages = false;
  let missingId = false;
  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!isRecord(change) || change.field !== "messages") continue;
      const value = change.value;
      if (!isRecord(value) || !Array.isArray(value.messages)) continue;
      for (const message of value.messages) {
        if (!isRecord(message)) continue;
        hasMessages = true;
        if (typeof message.id === "string" && message.id.length > 0) {
          ids.push(message.id);
        } else {
          missingId = true;
        }
      }
    }
  }
  return { ids: [...new Set(ids)], hasMessages, missingId };
}

async function defaultClaimWebhookEvent(input: ClaimWebhookEventInput) {
  const { claimWebhookEvent } =
    await import("../../db/queries/webhook-events.js");
  return claimWebhookEvent(input);
}

async function defaultEnqueueWebhook(data: WebhookDeliveryData) {
  const [{ getAgentQueue }, { enqueueWebhookDelivery }] = await Promise.all([
    import("../../jobs/queue.js"),
    import("../../jobs/webhook-delivery.js"),
  ]);
  await enqueueWebhookDelivery(getAgentQueue(), data);
}

function secretsMatch(expected: string, supplied: string | undefined) {
  const expectedDigest = crypto.createHash("sha256").update(expected).digest();
  const suppliedDigest = crypto
    .createHash("sha256")
    .update(supplied ?? "")
    .digest();
  const matches = crypto.timingSafeEqual(expectedDigest, suppliedDigest);
  return Boolean(expected && supplied) && matches;
}

export function createWebhookRoutes(options: WebhookRouteOptions = {}) {
  const routes = new Hono();
  const telegramMode = options.telegramMode ?? "disabled";
  const claimWebhookEvent =
    options.claimWebhookEvent ?? defaultClaimWebhookEvent;
  const enqueueWebhook = options.enqueueWebhook ?? defaultEnqueueWebhook;

  async function acceptEvent(data: WebhookDeliveryData, payloadHash: string) {
    const claim = await claimWebhookEvent({
      provider: data.provider,
      providerEventId: data.providerEventId,
      payloadHash,
    });
    if (claim.status !== "processed") {
      await enqueueWebhook(data);
    }
  }

  routes.post("/telegram", async (context) => {
    if (telegramMode !== "webhook") {
      return context.text("Telegram webhook mode is disabled", 404);
    }

    const suppliedSecret = context.req.header(
      "X-Telegram-Bot-Api-Secret-Token",
    );
    if (!secretsMatch(options.telegramWebhookSecret ?? "", suppliedSecret)) {
      return context.text("Unauthorized", 401);
    }

    if (!options.telegramBot) {
      log.warn("Telegram webhook received but no bot is registered");
      return context.text("Bot not configured", 503);
    }

    const rawBody = await context.req.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      return context.json({ error: "Invalid Telegram payload" }, 400);
    }

    if (!isProcessableTelegramEvent(payload)) {
      return context.text("Accepted", 202);
    }
    const providerEventId = getTelegramProviderEventId(payload);
    if (!providerEventId) {
      return context.json({ error: "Missing Telegram update_id" }, 400);
    }

    try {
      await acceptEvent(
        { provider: "telegram", providerEventId, payload },
        crypto.createHash("sha256").update(rawBody).digest("hex"),
      );
      return context.text("Accepted", 202);
    } catch {
      log.error("Telegram webhook could not be durably queued");
      return context.text("Webhook temporarily unavailable", 503);
    }
  });

  routes.get("/whatsapp", (context) => {
    if (!options.whatsappEnabled) {
      return context.text("WhatsApp webhooks are disabled", 404);
    }

    const url = new URL(context.req.url);
    const query = {
      "hub.mode": url.searchParams.get("hub.mode") ?? undefined,
      "hub.verify_token": url.searchParams.get("hub.verify_token") ?? undefined,
      "hub.challenge": url.searchParams.get("hub.challenge") ?? undefined,
    };

    const result = verifyWhatsAppWebhook(query, options.whatsappVerifyToken);
    if (!result.ok) {
      return context.text("Forbidden", 403);
    }

    return context.text(result.challenge ?? "", 200);
  });

  routes.post("/whatsapp", async (context) => {
    if (!options.whatsappEnabled) {
      return context.text("WhatsApp webhooks are disabled", 404);
    }

    const rawBody = await context.req.text();
    const signature = context.req.header("x-hub-signature-256");

    if (
      !verifyWhatsAppSignature(
        rawBody,
        signature,
        options.whatsappWebhookSecret,
      )
    ) {
      return context.json({ error: "Invalid WhatsApp signature" }, 401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      log.warn("WhatsApp webhook body was not valid JSON");
      return context.json({ error: "Invalid WhatsApp payload" }, 400);
    }

    const eventIds = getWhatsAppProviderEventIds(payload);
    if (eventIds.hasMessages && eventIds.missingId) {
      return context.json({ error: "Missing WhatsApp message id" }, 400);
    }
    if (eventIds.ids.length === 0) return context.text("Accepted", 202);

    const payloadHash = crypto
      .createHash("sha256")
      .update(rawBody)
      .digest("hex");
    try {
      for (const providerEventId of eventIds.ids) {
        await acceptEvent(
          { provider: "whatsapp", providerEventId, payload },
          payloadHash,
        );
      }
      return context.text("Accepted", 202);
    } catch {
      log.error("WhatsApp webhook could not be durably queued");
      return context.text("Webhook temporarily unavailable", 503);
    }
  });

  return routes;
}
