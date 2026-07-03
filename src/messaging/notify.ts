/**
 * Creator notification helpers.
 *
 * Thin wrappers around the Telegram/WhatsApp send functions so that
 * non-bot modules (orchestrator, jobs, etc.) can proactively message
 * creators without importing bot internals directly.
 */

import pino from "pino";
import { getCreatorById } from "../db/queries/creators.js";
import { sendMessageToCreator } from "../bot/telegram-sender.js";
import { sendWhatsAppMessage } from "../bot/whatsapp-sender.js";
import { formatUsd } from "../lib/format.js";

const log = pino({ name: "messaging:notify" });

const LOW_CREDIT_THRESHOLD_CENTS = 100; // $1.00

/**
 * Send a proactive message to a creator on all their connected channels.
 */
async function notifyCreator(creatorId: string, text: string): Promise<void> {
  try {
    const creator = await getCreatorById(creatorId);
    if (!creator) return;

    if (creator.telegram_chat_id) {
      sendMessageToCreator(creator.telegram_chat_id, {
        text,
        parseMode: "Markdown",
      }).catch((err) =>
        log.warn({ err, creatorId }, "Failed to notify creator via Telegram"),
      );
    }

    if (creator.whatsapp_phone) {
      // Strip markdown for WhatsApp plain text
      const plainText = text.replace(/[*_`\[\]()]/g, "");
      sendWhatsAppMessage(creator.whatsapp_phone, { text: plainText }).catch(
        (err) =>
          log.warn({ err, creatorId }, "Failed to notify creator via WhatsApp"),
      );
    }
  } catch (err) {
    log.warn({ err, creatorId }, "notifyCreator failed");
  }
}

/**
 * Check if credits just crossed the low-credit threshold and notify if so.
 * Call this after every credit deduction.
 */
export async function maybeSendLowCreditAlert(
  creatorId: string,
  newBalanceCents: number,
): Promise<void> {
  if (newBalanceCents > LOW_CREDIT_THRESHOLD_CENTS) return;
  if (newBalanceCents <= 0) {
    await notifyCreator(
      creatorId,
      "⚠️ *You've run out of Indyfren credits.*\n\nYou can still use free commands (/calendar, /finances, /content), but paid tools like brand scanning and web research need a top-up.\n\n👛 Top up from your wallet: [open dashboard](https://app.indyfren.com/wallet)",
    );
    return;
  }
  await notifyCreator(
    creatorId,
    `⚡ *Low credits: ${formatUsd(newBalanceCents)} remaining.*\n\nTop up to keep your AI manager running at full power.\n\n👛 [Top up now](https://app.indyfren.com/wallet)`,
  );
}
