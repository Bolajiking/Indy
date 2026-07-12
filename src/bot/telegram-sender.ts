import pino from "#logger";
import { Bot, InlineKeyboard } from "grammy";
import type { OutgoingMessage } from "./messages.js";

const log = pino({ name: "bot:telegram:sender" });
let activeBot: Bot | null = null;

function buildTelegramOptions(response: OutgoingMessage) {
  const options: Record<string, unknown> = {};

  if (response.parseMode) {
    options.parse_mode = response.parseMode;
  }

  if (response.buttons?.length) {
    const keyboard = new InlineKeyboard();
    for (const button of response.buttons) {
      keyboard.text(button.text, button.callbackData);
    }
    options.reply_markup = keyboard;
  }

  return options;
}

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

/**
 * Split a long message into chunks that fit Telegram's 4096 char limit.
 * Tries to break on newlines, falls back to hard split.
 */
export function splitMessage(
  text: string,
  maxLen = TELEGRAM_MAX_MESSAGE_LENGTH,
): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Try to break at a newline within range
    let breakIndex = remaining.lastIndexOf("\n", maxLen);
    if (breakIndex < maxLen * 0.3) {
      // No good newline break - break at space
      breakIndex = remaining.lastIndexOf(" ", maxLen);
    }
    if (breakIndex < maxLen * 0.3) {
      // Hard break
      breakIndex = maxLen;
    }

    chunks.push(remaining.slice(0, breakIndex));
    remaining = remaining.slice(breakIndex).trimStart();
  }

  return chunks;
}

export async function sendMessageToCreator(
  chatId: string,
  response: OutgoingMessage,
  bot: Bot | null = activeBot,
) {
  if (!bot) {
    log.warn(
      { chatId },
      "Telegram bot is not registered; skipping outbound message",
    );
    return;
  }

  try {
    const chunks = splitMessage(response.text);

    for (let i = 0; i < chunks.length; i++) {
      // Only attach buttons to the last chunk
      const isLast = i === chunks.length - 1;
      const chunkResponse: OutgoingMessage = {
        text: chunks[i],
        parseMode: response.parseMode,
        buttons: isLast ? response.buttons : undefined,
      };

      await bot.api.sendMessage(
        Number(chatId),
        chunkResponse.text,
        buildTelegramOptions(chunkResponse),
      );
    }
  } catch (error) {
    log.error({ chatId, error }, "Failed to send Telegram message");

    // If Markdown parsing fails, retry without formatting
    if (response.parseMode) {
      try {
        const plainText = response.text.replace(
          /[*_`\[\]()~>#+=|{}.!\\-]/g,
          "",
        );
        await bot.api.sendMessage(Number(chatId), plainText);
      } catch (retryError) {
        log.error(
          { chatId, retryError },
          "Telegram plain-text fallback also failed",
        );
      }
    }
  }
}

export function registerTelegramBot(bot: Bot) {
  activeBot = bot;
}
