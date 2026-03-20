import pino from "pino";
import { runAgent } from "../agent/orchestrator.js";
import {
  createCreator,
  findCreatorByTelegram,
  findCreatorByWhatsApp,
  type Creator,
} from "../db/queries/creators.js";
import { saveMessage } from "../db/queries/messages.js";
import { storePendingApproval } from "./approval.js";
import { ensureCreatorWalletProvisioning } from "../wallet/provisioning.js";
import { getCalendarView } from "../agent/skills/calendar-manager.js";
import { generateFinancialSnapshot } from "../agent/skills/financial-tracker.js";
import { generateContentStrategy } from "../agent/skills/content-strategy.js";
import {
  formatFinancialSnapshot,
  formatContentStrategy,
} from "./formatters.js";

const log = pino({ name: "bot:handler" });

export type Platform = "telegram" | "whatsapp";

export interface IncomingMessage {
  platform: Platform;
  platformUserId: string;
  displayName: string;
  text: string;
}

export interface OutgoingMessage {
  text: string;
  parseMode?: "Markdown" | "HTML";
  buttons?: Array<{ text: string; callbackData: string }>;
}

async function findCreatorForMessage(
  message: IncomingMessage
): Promise<Creator | null> {
  if (message.platform === "telegram") {
    return findCreatorByTelegram(message.platformUserId);
  }

  return findCreatorByWhatsApp(message.platformUserId);
}

export async function handleMessage(
  message: IncomingMessage
): Promise<OutgoingMessage> {
  try {
    return await handleMessageInner(message);
  } catch (err) {
    log.error({ error: err, platform: message.platform, user: message.platformUserId }, "Unhandled error in handleMessage");
    return {
      text: "Something went wrong on my end. Please try again in a moment.",
      parseMode: "Markdown",
    };
  }
}

async function handleMessageInner(
  message: IncomingMessage
): Promise<OutgoingMessage> {
  log.info(
    { platform: message.platform, user: message.platformUserId },
    "Incoming message"
  );

  let creator = await findCreatorForMessage(message);

  if (!creator) {
    creator = await createCreator({
      display_name: message.displayName,
      telegram_chat_id:
        message.platform === "telegram" ? message.platformUserId : undefined,
      whatsapp_phone:
        message.platform === "whatsapp" ? message.platformUserId : undefined,
    });

    await ensureCreatorWalletProvisioning(creator.id, {
      force: true,
      source: "messaging_onboarding",
    }).catch((error) => {
      log.error(
        { creatorId: creator?.id, error },
        "Wallet provisioning trigger failed during onboarding"
      );
    });

    return {
      text: `👋 Hey ${message.displayName}! I'm *Indyfren* — your AI business manager.\n\n🔐 I'm setting up your wallet on Tempo Network in the background so you can get started right away.\n\n*Tell me about yourself:*\n📱 What platforms are you on?\n👥 What's your follower count?\n🎯 What's your niche? (e.g., tech, fitness, finance)\n\n*Or just say:*\n💼 "scan for deals" — I'll find brand opportunities\n📊 "my rates" — See your rate card\n💰 "wallet" — Check your balance\n\nType /help anytime to see all commands!`,
      parseMode: "Markdown",
    };
  }

  const normalizedText = message.text.toLowerCase().trim();

  if (normalizedText === "/start" || normalizedText === "/help" || normalizedText === "hi" || normalizedText === "hello" || normalizedText === "help") {
    return {
      text: `👋 Welcome back, ${creator.display_name}! What can I help with?\n\n*Quick Commands:*\n💼 /scan — Find brand deals\n📊 /deals — View deal pipeline\n📅 /calendar — Upcoming deadlines\n💰 /finances — Financial snapshot\n👛 /wallet — Check balance\n📝 /content — Content strategy\n☀️ /brief — Morning brief\n\n*Or just chat with me:*\n"What's my rate for a sponsored post?"\n"Draft a pitch for TechCorp"\n"Show me my analytics"\n\nType /help anytime to see this menu.`,
      parseMode: "Markdown",
    };
  }

  if (normalizedText === "/calendar" || normalizedText === "calendar" || normalizedText === "deadlines") {
    try {
      const calendar = await getCalendarView(creator.id);
      let text = "*Upcoming Deadlines*\n\n";
      if (calendar.overdue.length > 0) {
        text += `⚠️ *${calendar.overdue.length} overdue:*\n`;
        for (const e of calendar.overdue.slice(0, 5)) {
          text += `• ${e.title} (${e.date})\n`;
        }
        text += "\n";
      }
      if (calendar.upcoming.length > 0) {
        text += `📅 *${calendar.upcoming.length} upcoming:*\n`;
        for (const e of calendar.upcoming.slice(0, 5)) {
          text += `• ${e.title} (${e.date})\n`;
        }
      }
      if (calendar.overdue.length === 0 && calendar.upcoming.length === 0) {
        text += "No upcoming deadlines. Your calendar is clear!";
      }
      return { text, parseMode: "Markdown" };
    } catch (err) {
      log.error({ creatorId: creator.id, error: err }, "Calendar command failed");
      return { text: "Sorry, I couldn't load your calendar right now. Try again in a moment.", parseMode: "Markdown" };
    }
  }

  if (normalizedText === "/finances" || normalizedText === "finances" || normalizedText === "financial" || normalizedText === "money") {
    try {
      const snapshot = await generateFinancialSnapshot(creator.id);
      return { text: formatFinancialSnapshot(snapshot), parseMode: "Markdown" };
    } catch (err) {
      log.error({ creatorId: creator.id, error: err }, "Financial snapshot command failed");
      return { text: "Sorry, I couldn't pull your financial data right now. Try again in a moment.", parseMode: "Markdown" };
    }
  }

  if (normalizedText === "/content" || normalizedText === "content plan" || normalizedText === "content strategy" || normalizedText === "content") {
    try {
      const strategy = await generateContentStrategy(creator.id);
      return { text: formatContentStrategy(strategy), parseMode: "Markdown" };
    } catch (err) {
      log.error({ creatorId: creator.id, error: err }, "Content strategy command failed");
      return { text: "Sorry, I couldn't generate your content plan right now. Try again in a moment.", parseMode: "Markdown" };
    }
  }

  // Handle other slash commands by rewriting them to natural language
  if (normalizedText === "/scan") {
    message.text = "scan for brand deals";
  } else if (normalizedText === "/deals") {
    message.text = "show my deal pipeline";
  } else if (normalizedText === "/wallet") {
    message.text = "show my wallet balance";
  } else if (normalizedText === "/brief") {
    message.text = "give me my morning brief";
  }

  // Save user message
  await saveMessage({
    creator_id: creator.id,
    role: "user",
    content: message.text,
    metadata: { platform: message.platform },
  }).catch((err) => log.warn({ error: err.message }, "Failed to save user message"));

  const agentResponse = await runAgent(
    creator.id,
    message.text,
    creator.wallet_id ?? undefined,
    creator.wallet_address ?? undefined
  );

  // Save agent response
  await saveMessage({
    creator_id: creator.id,
    role: "assistant",
    content: agentResponse.text,
    metadata: { requiresApproval: agentResponse.requiresApproval },
  }).catch((err) => log.warn({ error: err.message }, "Failed to save agent message"));

  if (agentResponse.requiresApproval && agentResponse.pendingAction) {
    await storePendingApproval({
      id: agentResponse.pendingAction.id,
      creatorId: creator.id,
      actionId: agentResponse.pendingAction.id,
      type: agentResponse.pendingAction.type,
      description: agentResponse.pendingAction.description,
      preview: agentResponse.text,
      input: agentResponse.pendingAction.input,
    });

    return {
      text: `${agentResponse.text}\n\n⚡ _This action needs your approval._`,
      parseMode: "Markdown",
      buttons: [
        {
          text: "✅ Send",
          callbackData: `approve:${creator.id}:${agentResponse.pendingAction.id}`,
        },
        {
          text: "❌ Skip",
          callbackData: `skip:${creator.id}:${agentResponse.pendingAction.id}`,
        },
      ],
    };
  }

  return {
    text: agentResponse.text,
    parseMode: "Markdown",
  };
}
