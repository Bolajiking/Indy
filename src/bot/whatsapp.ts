import crypto from "crypto";
import { env } from "../config/env.js";
import { handleMessage } from "./handler.js";
import type { OutgoingMessage } from "./messages.js";
export { sendWhatsAppMessage } from "./whatsapp-sender.js";

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

function isWhatsAppWebhookPayload(
  payload: unknown,
): payload is WhatsAppWebhookPayload {
  return (
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
  );
}

export function verifyWhatsAppWebhook(
  query: Record<string, string | undefined>,
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
  signature: string | undefined,
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
  payload: unknown,
): Promise<Array<{ to: string; response: OutgoingMessage }>> {
  if (!isWhatsAppWebhookPayload(payload)) {
    return [];
  }

  if (payload.object !== "whatsapp_business_account") {
    return [];
  }

  const responses: Array<{ to: string; response: OutgoingMessage }> = [];

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes) {
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
