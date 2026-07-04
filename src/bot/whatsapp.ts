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
  verifyToken = env.WHATSAPP_VERIFY_TOKEN,
): { ok: boolean; challenge?: string } {
  if (
    verifyToken.length > 0 &&
    query["hub.mode"] === "subscribe" &&
    query["hub.verify_token"] === verifyToken
  ) {
    return { ok: true, challenge: query["hub.challenge"] ?? "" };
  }

  return { ok: false };
}

export function verifyWhatsAppSignature(
  payload: string,
  signature: string | undefined,
  secret = env.WHATSAPP_WEBHOOK_SECRET,
): boolean {
  if (!secret || !signature) {
    return false;
  }

  const match = /^sha256=([a-fA-F0-9]{64})$/.exec(signature);
  if (!match) return false;

  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  const supplied = Buffer.from(match[1], "hex");

  return (
    supplied.length === expected.length &&
    crypto.timingSafeEqual(supplied, expected)
  );
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
