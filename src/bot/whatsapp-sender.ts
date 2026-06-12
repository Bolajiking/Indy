import pino from "pino";
import { env } from "../config/env.js";
import type { OutgoingMessage } from "./messages.js";

const log = pino({ name: "bot:whatsapp:sender" });

async function readWhatsAppErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    log.warn(
      { error, status: response.status },
      "Failed to read WhatsApp error response body",
    );
    return "";
  }
}

export async function sendWhatsAppMessage(
  to: string,
  response: OutgoingMessage,
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
    const body = await readWhatsAppErrorBody(result);
    log.error({ to, status: result.status, body }, "WhatsApp send failed");
  }
}
