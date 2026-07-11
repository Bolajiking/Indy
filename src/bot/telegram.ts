import pino from "#logger";
import { Bot } from "grammy";
import { env } from "../config/env.js";
import { getPendingApprovalByAction, markApprovalSkipped } from "./approval.js";
import { findCreatorByTelegram, type Creator } from "../db/queries/creators.js";
import { saveCreatorFeedback } from "../agent/os/creator-memory.js";
import { handleMessage } from "./handler.js";
import { ipv4Fetch } from "../network/ipv4-fetch.js";
import { formatUsd } from "../lib/format.js";
import { sendMessageToCreator } from "./telegram-sender.js";
import {
  ApprovalExecutionError,
  executePendingApprovalAction,
} from "../agent/approval-execution.js";
export {
  registerTelegramBot,
  sendMessageToCreator,
  splitMessage,
} from "./telegram-sender.js";

const log = pino({ name: "bot:telegram" });

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

export type TelegramApprovalCallbackResolution =
  | {
      status: "authorized";
      approval: NonNullable<
        Awaited<ReturnType<typeof getPendingApprovalByAction>>
      >;
    }
  | { status: "unauthorized" }
  | { status: "expired" };

/**
 * Callback data names an action, but never authenticates its sender. Resolve
 * the Telegram user first, then compare its linked creator to the action owner.
 */
export async function resolveTelegramApprovalCallback(input: {
  telegramUserId: string;
  creatorIdHint: string;
  actionId: string;
}): Promise<TelegramApprovalCallbackResolution> {
  const callbackCreator = await findCreatorByTelegram(input.telegramUserId);
  if (!callbackCreator) return { status: "unauthorized" };

  const approval = await getPendingApprovalByAction(
    input.creatorIdHint,
    input.actionId,
  );
  if (!approval) return { status: "expired" };

  if (approval.creatorId !== callbackCreator.id) {
    return { status: "unauthorized" };
  }

  return { status: "authorized", approval };
}

async function resolveTelegramFeedbackCreator(input: {
  telegramUserId: string;
  creatorIdHint: string;
}): Promise<Creator | null> {
  const callbackCreator = await findCreatorByTelegram(input.telegramUserId);
  if (!callbackCreator || callbackCreator.id !== input.creatorIdHint) {
    return null;
  }

  return callbackCreator;
}

// Track pending "tell me what was wrong" prompts by authenticated Telegram user.
const pendingFeedbackRequests = new Map<
  string,
  { creatorId: string; skill: string }
>();

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
  bot.api
    .setMyCommands([
      { command: "start", description: "Welcome message" },
      { command: "help", description: "Show available commands" },
      { command: "scan", description: "Find brand deals" },
      { command: "deals", description: "Show deal pipeline" },
      { command: "wallet", description: "Check wallet balance" },
      { command: "calendar", description: "View upcoming deadlines" },
      { command: "finances", description: "Financial snapshot" },
      { command: "content", description: "Content strategy" },
      { command: "brief", description: "Morning brief" },
    ])
    .catch((error) => {
      log.warn({ error }, "Failed to set bot commands");
    });

  bot.on("message:text", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const telegramUserId = ctx.from ? String(ctx.from.id) : "";
    const displayName = ctx.from?.first_name ?? ctx.from?.username ?? "Creator";

    // Check if this is a pending feedback clarification
    const pendingFeedback = telegramUserId
      ? pendingFeedbackRequests.get(telegramUserId)
      : undefined;
    if (pendingFeedback) {
      pendingFeedbackRequests.delete(telegramUserId);
      const { creatorId, skill } = pendingFeedback;
      await saveCreatorFeedback(
        creatorId,
        skill,
        `Creator correction (👎): ${ctx.message.text}`,
      ).catch((error) => {
        log.warn(
          { error, creatorId, skill },
          "Failed to save creator feedback",
        );
      });
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
      await ctx.reply(
        "❌ Something went wrong on my end. Please try again in a moment.",
      );
    }
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const telegramUserId = ctx.from ? String(ctx.from.id) : "";

    if (!telegramUserId) {
      await ctx.answerCallbackQuery({
        text: "❌ Unable to verify your account",
      });
      return;
    }

    // Handle feedback callbacks
    const feedbackParsed = parseFeedbackCallbackData(data);
    if (feedbackParsed) {
      const { direction, creatorId, skill } = feedbackParsed;
      const callbackCreator = await resolveTelegramFeedbackCreator({
        telegramUserId,
        creatorIdHint: creatorId,
      });
      if (!callbackCreator) {
        await ctx.answerCallbackQuery({
          text: "❌ This feedback is not yours",
        });
        return;
      }
      const chatId = String(ctx.chat?.id ?? ctx.from?.id);

      if (direction === "up") {
        await saveCreatorFeedback(
          callbackCreator.id,
          skill,
          "Creator rated this response positively (👍)",
        ).catch((error) => {
          log.warn(
            { error, creatorId, skill },
            "Failed to save creator feedback",
          );
        });
        await ctx.answerCallbackQuery({ text: "👍 Got it, thanks!" });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
      } else {
        // Ask for specifics
        pendingFeedbackRequests.set(telegramUserId, {
          creatorId: callbackCreator.id,
          skill,
        });
        await ctx.answerCallbackQuery({ text: "Thanks for the feedback" });
        await ctx.editMessageReplyMarkup({ reply_markup: undefined });
        await ctx.reply(
          "What was off? (e.g. rates too low, wrong tone, irrelevant brand) — I'll remember this.",
        );
      }
      return;
    }

    const parsed = parseApprovalCallbackData(data);
    if (!parsed) {
      await ctx.answerCallbackQuery({ text: "❌ Unknown action" });
      return;
    }

    const resolution = await resolveTelegramApprovalCallback({
      telegramUserId,
      creatorIdHint: parsed.creatorId,
      actionId: parsed.actionId,
    });
    if (resolution.status === "unauthorized") {
      await ctx.answerCallbackQuery({ text: "❌ This action is not yours" });
      return;
    }
    if (resolution.status === "expired") {
      await ctx.answerCallbackQuery({ text: "⏰ Action expired" });
      await ctx.reply("⏰ That action has expired or was already handled.");
      return;
    }
    const { approval } = resolution;

    if (parsed.action === "skip") {
      await markApprovalSkipped(approval.actionId);
      await ctx.answerCallbackQuery({ text: "❌ Skipped" });
      await ctx.reply("✅ Got it. I skipped that action.");
      return;
    }

    await ctx.answerCallbackQuery({ text: "⚡ Approved — executing..." });
    await ctx.reply("⚡ *Approved.* Executing now...", {
      parse_mode: "Markdown",
    });

    try {
      const result = await executePendingApprovalAction(
        approval.creatorId,
        approval.actionId,
      );
      const costMsg = result.costCents
        ? ` _(cost: ${formatUsd(result.costCents)})_`
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
