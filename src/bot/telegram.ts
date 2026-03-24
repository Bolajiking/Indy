import pino from "pino";
import { Bot, InlineKeyboard } from "grammy";
import { env } from "../config/env.js";
import {
  getPendingApprovalByAction,
  markApprovalSkipped,
} from "./approval.js";
import { saveCreatorFeedback } from "../agent/os/creator-memory.js";
import { handleMessage, type OutgoingMessage } from "./handler.js";
import { ipv4Fetch } from "../network/ipv4-fetch.js";
import {
  ApprovalExecutionError,
  executePendingApprovalAction,
} from "../agent/approval-execution.js";

const log = pino({ name: "bot:telegram" });
let activeBot: Bot | null = null;

function parseApprovalCallbackData(data: string) {
  const parts = data.split(":");
  const [action, creatorId, actionId] = parts;
  if ((action !== "approve" && action !== "skip") || !creatorId || !actionId) {
    return null;
  }

  return { action, creatorId, actionId };
}

function parseFeedbackCallbackData(data: string) {
  // format: feedback:up|down:creatorId:skill
  const parts = data.split(":");
  if (parts[0] !== "feedback" || parts.length < 4) return null;
  const [, direction, creatorId, ...skillParts] = parts;
  if (direction !== "up" && direction !== "down") return null;
  return { direction, creatorId, skill: skillParts.join(":") };
}

// Track pending "tell me what was wrong" prompts: chatId → { creatorId, skill }
const pendingFeedbackRequests = new Map<string, { creatorId: string; skill: string }>();

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
export function splitMessage(text: string, maxLen = TELEGRAM_MAX_MESSAGE_LENGTH): string[] {
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
      // No good newline break — break at space
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
  bot: Bot | null = activeBot
) {
  if (!bot) {
    log.warn({ chatId }, "Telegram bot is not registered; skipping outbound message");
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
        buildTelegramOptions(chunkResponse)
      );
    }
  } catch (error) {
    log.error({ chatId, error }, "Failed to send Telegram message");

    // If Markdown parsing fails, retry without formatting
    if (response.parseMode) {
      try {
        const plainText = response.text.replace(/[*_`\[\]()~>#+=|{}.!\\-]/g, "");
        await bot.api.sendMessage(Number(chatId), plainText);
      } catch (retryError) {
        log.error({ chatId, retryError }, "Telegram plain-text fallback also failed");
      }
    }
  }
}

export function registerTelegramBot(bot: Bot) {
  activeBot = bot;
}

export function isTelegramConfigured(): boolean {
  return env.TELEGRAM_BOT_TOKEN.trim().length > 0;
}

export function createTelegramBot(): Bot {
  if (!isTelegramConfigured()) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const bot = new Bot(env.TELEGRAM_BOT_TOKEN, {
    client: {
      fetch: ipv4Fetch,
    },
  });

  // Set bot commands for Telegram menu
  bot.api.setMyCommands([
    { command: "start", description: "Welcome message" },
    { command: "help", description: "Show available commands" },
    { command: "scan", description: "Find brand deals" },
    { command: "deals", description: "Show deal pipeline" },
    { command: "wallet", description: "Check wallet balance" },
    { command: "calendar", description: "View upcoming deadlines" },
    { command: "finances", description: "Financial snapshot" },
    { command: "content", description: "Content strategy" },
    { command: "brief", description: "Morning brief" },
  ]).catch((error) => {
    log.warn({ error }, "Failed to set bot commands");
  });

  bot.on("message:text", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const displayName = ctx.from?.first_name ?? ctx.from?.username ?? "Creator";

    // Check if this is a pending feedback clarification
    const pendingFeedback = pendingFeedbackRequests.get(chatId);
    if (pendingFeedback) {
      pendingFeedbackRequests.delete(chatId);
      const { creatorId, skill } = pendingFeedback;
      await saveCreatorFeedback(
        creatorId,
        skill,
        `Creator correction (👎): ${ctx.message.text}`
      ).catch(() => {});
      await ctx.reply("Got it — I'll factor that in next time. 🙏");
      return;
    }

    try {
      // Show typing indicator for better UX
      await ctx.replyWithChatAction("typing");

      const response = await handleMessage({
        platform: "telegram",
        platformUserId: chatId,
        displayName,
        text: ctx.message.text,
      });

      await sendMessageToCreator(chatId, response, bot);
    } catch (error) {
      log.error({ error, chatId }, "Failed to handle Telegram message");
      await ctx.reply("❌ Something went wrong on my end. Please try again in a moment.");
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    // Handle feedback callbacks
    const feedbackParsed = parseFeedbackCallbackData(data);
    if (feedbackParsed) {
      const { direction, creatorId, skill } = feedbackParsed;
      const chatId = String(ctx.chat?.id ?? ctx.from?.id);

      if (direction === "up") {
        await saveCreatorFeedback(creatorId, skill, "Creator rated this response positively (👍)").catch(() => {});
        await ctx.answerCallbackQuery({ text: "👍 Got it, thanks!" });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      } else {
        // Ask for specifics
        pendingFeedbackRequests.set(chatId, { creatorId, skill });
        await ctx.answerCallbackQuery({ text: "Thanks for the feedback" });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply("What was off? (e.g. rates too low, wrong tone, irrelevant brand) — I'll remember this.");
      }
      return;
    }

    const parsed = parseApprovalCallbackData(data);
    if (!parsed) {
      await ctx.answerCallbackQuery({ text: "❌ Unknown action" });
      return;
    }

    const approval = await getPendingApprovalByAction(parsed.creatorId, parsed.actionId);
    if (!approval) {
      await ctx.answerCallbackQuery({ text: "⏰ Action expired" });
      await ctx.reply("⏰ That action has expired or was already handled.");
      return;
    }

    if (parsed.action === "skip") {
      await markApprovalSkipped(approval.actionId);
      await ctx.answerCallbackQuery({ text: "❌ Skipped" });
      await ctx.reply("✅ Got it. I skipped that action.");
      return;
    }

    await ctx.answerCallbackQuery({ text: "⚡ Approved — executing..." });
    await ctx.reply("⚡ *Approved.* Executing now...", { parse_mode: "Markdown" });

    try {
      const result = await executePendingApprovalAction(
        approval.creatorId,
        approval.actionId
      );
      const costMsg = result.costCents
        ? ` _(cost: $${(result.costCents / 100).toFixed(2)})_`
        : "";
      await ctx.reply(`✅ *Done!* ${result.message}${costMsg}`, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      log.error({ error, approval }, "Failed to execute approved action");
      const message =
        error instanceof ApprovalExecutionError
          ? error.message
          : "Something went wrong executing that action. Please try again or contact support if this persists.";
      await ctx.reply(`❌ ${message}`);
    }
  });

  bot.catch((error) => {
    log.error({ error }, "Telegram bot error");
  });

  return bot;
}
