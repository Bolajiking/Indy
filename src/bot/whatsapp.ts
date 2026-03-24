import crypto from "crypto";
import pino from "pino";
import { env } from "../config/env.js";
import { handleMessage, type OutgoingMessage } from "./handler.js";

const log = pino({ name: "bot:whatsapp" });

export interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        contacts?: Array<{ profile?: { name?: string } }>;
        messages?: Array<{
          from?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
}

export function verifyWhatsAppWebhook(
  query: Record<string, string | undefined>
): { ok: boolean; challenge?: string } {
  if (
    query["hub.mode"] === "subscribe" &&
    query["hub.verify_token"] === env.WHATSAPP_VERIFY_TOKEN
  ) {
    return { ok: true, challenge: query["hub.challenge"] ?? "" };
  }

  return { ok: false };
}

export function verifyWhatsAppSignature(
  payload: string,
  signature: string | undefined
): boolean {
  if (!env.WHATSAPP_WEBHOOK_SECRET || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", env.WHATSAPP_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");

  return signature === `sha256=${expected}`;
}

export async function handleWhatsAppWebhookPayload(
  payload: WhatsAppWebhookPayload
): Promise<Array<{ to: string; response: OutgoingMessage }>> {
  if (payload.object !== "whatsapp_business_account") {
    return [];
  }

  const responses: Array<{ to: string; response: OutgoingMessage }> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") {
        continue;
      }

      const message = change.value?.messages?.[0];
      if (!message?.from || message.type !== "text") {
        continue;
      }

      const response = await handleMessage({
        platform: "whatsapp",
        platformUserId: message.from,
        displayName: change.value?.contacts?.[0]?.profile?.name ?? "Creator",
        text: message.text?.body ?? "",
      });

      responses.push({ to: message.from, response });
    }
  }

  return responses;
}

export async function sendWhatsAppMessage(
  to: string,
  response: OutgoingMessage
): Promise<void> {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    log.warn({ to }, "WhatsApp not configured; skipping outbound message");
    return;
  }

  const plainText = response.text.replace(/[*_`]/g, "");
  const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const result = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: plainText },
    }),
  });

  if (!result.ok) {
    const body = await result.text().catch(() => "");
    log.error({ to, status: result.status, body }, "WhatsApp send failed");
  }
}
