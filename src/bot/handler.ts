import pino from "pino";
import {
  createCreator,
  findCreatorByTelegram,
  findCreatorByWhatsApp,
  updateCreator,
  type Creator,
} from "../db/queries/creators.js";
import { processCreatorMessage } from "../agent/conversation.js";
import { ensureCreatorWalletProvisioning } from "../wallet/provisioning.js";
import { connectMessagingChannelFromToken } from "../messaging/linking.js";
import { upsertCreatorMemory } from "../db/queries/creator-memories.js";
import type { IncomingMessage, OutgoingMessage } from "./messages.js";

const log = pino({ name: "bot:handler" });

// Skills that produce advice worth rating with thumbs up/down
const FEEDBACK_ELIGIBLE_SKILLS = new Set([
  "rate-calculator",
  "pitch-generator",
  "brand-deal-scanner",
  "contract-reviewer",
  "revenue-advisor",
  "content-strategy",
]);

export type { IncomingMessage, OutgoingMessage, Platform } from "./messages.js";

async function findCreatorForMessage(
  message: IncomingMessage,
): Promise<Creator | null> {
  if (message.platform === "telegram") {
    return findCreatorByTelegram(message.platformUserId);
  }

  return findCreatorByWhatsApp(message.platformUserId);
}

function extractMessagingLinkToken(text: string): string | null {
  const trimmed = text.trim();
  const telegramMatch = trimmed.match(
    /^\/start(?:@\w+)?\s+link_([A-Za-z0-9\-_]+)$/i,
  );
  if (telegramMatch) {
    return telegramMatch[1];
  }

  const genericMatch = trimmed.match(/^link(?:[_\s-]+)([A-Za-z0-9\-_]+)$/i);
  if (genericMatch) {
    return genericMatch[1];
  }

  return null;
}

export async function handleMessage(
  message: IncomingMessage,
): Promise<OutgoingMessage> {
  try {
    return await handleMessageInner(message);
  } catch (err) {
    log.error(
      { error: err, platform: message.platform, user: message.platformUserId },
      "Unhandled error in handleMessage",
    );
    return {
      text: "Something went wrong on my end. Please try again in a moment.",
      parseMode: "Markdown",
    };
  }
}

async function handleBotOnboardingStep(
  creator: Creator,
  text: string,
  step: number,
  platform: IncomingMessage["platform"],
): Promise<OutgoingMessage> {
  const answer = text.trim();

  if (step === 1) {
    // Got niche answer — save and ask about platforms
    await upsertCreatorMemory(creator.id, {
      memory_type: "context",
      skill: null,
      key: "onboarding.niche",
      content: `Content niche: ${answer}`,
      confidence: 1.0,
    });
    await updateCreator(creator.id, {
      niche: answer,
      settings: { ...(creator.settings ?? {}), bot_onboarding_step: 2 },
    });

    return {
      text: `Great — *${answer}* creator, noted! 🎯\n\n📱 Which platforms are you most active on?\n_(e.g. Instagram, TikTok, YouTube, Twitter/X, LinkedIn — list as many as you like)_`,
      parseMode: "Markdown",
    };
  }

  if (step === 2) {
    // Got platforms — save and ask about follower count
    await upsertCreatorMemory(creator.id, {
      memory_type: "context",
      skill: null,
      key: "onboarding.platforms",
      content: `Active platforms: ${answer}`,
      confidence: 1.0,
    });
    await updateCreator(creator.id, {
      settings: { ...(creator.settings ?? {}), bot_onboarding_step: 3 },
    });

    return {
      text: `Got it — ${answer}. 📱\n\n👥 What's your approximate total follower count across all platforms?\n_(e.g. "50K on Instagram", "200K total", "about 10K")_`,
      parseMode: "Markdown",
    };
  }

  if (step === 3) {
    // Got follower count — save everything, mark onboarding complete, run first scan
    await upsertCreatorMemory(creator.id, {
      memory_type: "context",
      skill: null,
      key: "onboarding.follower_count",
      content: `Follower count: ${answer}`,
      confidence: 1.0,
    });
    await updateCreator(creator.id, {
      settings: {
        ...(creator.settings ?? {}),
        bot_onboarding_step: "complete",
        onboarding_complete: true,
      },
    });

    log.info(
      { creatorId: creator.id },
      "Bot onboarding complete — running first brand scan",
    );

    // Run first brand opportunity scan via the agent
    try {
      const scanResult = await processCreatorMessage({
        creatorId: creator.id,
        text: `My profile is complete: I'm a ${creator.niche ?? "content creator"} with ${answer} followers. Can you quickly scan for 2-3 brand deals that would be a great fit for me, and tell me what my recommended rate should be for a sponsored post? Keep it concise.`,
        metadata: { platform },
      });

      return {
        text: `✅ *Profile complete!* Here's your first opportunity scan:\n\n${scanResult.text}\n\n---\n💬 You can now chat with me anytime. Try:\n• "scan for deals"\n• "what's my rate?"\n• /help for all commands`,
        parseMode: "Markdown",
      };
    } catch (err) {
      log.error(
        { creatorId: creator.id, err },
        "First scan failed during bot onboarding",
      );
      return {
        text: `✅ *You're all set, ${creator.display_name}!*\n\nI've saved your profile. Here's what I can do for you:\n\n💼 "scan for deals" — Find brand opportunities\n📊 "my rates" — Get your recommended rate card\n💰 "wallet" — Check your balance\n\nType /help anytime to see all commands!`,
        parseMode: "Markdown",
      };
    }
  }

  // Fallback — unknown step, reset to agent
  await updateCreator(creator.id, {
    settings: {
      ...(creator.settings ?? {}),
      bot_onboarding_step: "complete",
      onboarding_complete: true,
    },
  });
  return {
    text: "You're all set! What would you like to work on?",
    parseMode: "Markdown",
  };
}

async function handleMessageInner(
  message: IncomingMessage,
): Promise<OutgoingMessage> {
  log.info(
    { platform: message.platform, user: message.platformUserId },
    "Incoming message",
  );

  const linkToken = extractMessagingLinkToken(message.text);
  if (linkToken) {
    const linkResult = await connectMessagingChannelFromToken({
      platform: message.platform,
      token: linkToken,
      platformUserId: message.platformUserId,
    });

    if (
      linkResult.status === "linked" ||
      linkResult.status === "already_linked"
    ) {
      return {
        text:
          `✅ Your ${message.platform === "telegram" ? "Telegram" : "WhatsApp"} is now connected to *${linkResult.creator.display_name}*.\n\n` +
          `You can message me here anytime to scan deals, check your wallet, review approvals, and manage your creator business.`,
        parseMode: "Markdown",
      };
    }

    if (linkResult.status === "channel_in_use") {
      return {
        text:
          `⚠️ This ${message.platform === "telegram" ? "Telegram account" : "WhatsApp number"} is already connected to another Indyfren creator profile.\n\n` +
          "Sign into the matching dashboard account or contact support if you need help moving it.",
        parseMode: "Markdown",
      };
    }

    return {
      text: "⏰ That connect code is invalid or expired. Generate a fresh Telegram or WhatsApp link from your dashboard settings and try again.",
      parseMode: "Markdown",
    };
  }

  let creator = await findCreatorForMessage(message);

  if (!creator) {
    creator = await createCreator({
      display_name: message.displayName,
      telegram_chat_id:
        message.platform === "telegram" ? message.platformUserId : undefined,
      whatsapp_phone:
        message.platform === "whatsapp" ? message.platformUserId : undefined,
      settings: { bot_onboarding_step: 1 },
    });

    await ensureCreatorWalletProvisioning(creator.id, {
      force: true,
      source: "messaging_onboarding",
    }).catch((error) => {
      log.error(
        { creatorId: creator?.id, error },
        "Wallet provisioning trigger failed during onboarding",
      );
    });

    return {
      text: `👋 Hey ${message.displayName}! I'm *Indyfren* — your AI business manager for creators.\n\nI help you find brand deals, negotiate better rates, review contracts, and track your revenue — all on autopilot.\n\n🔐 Setting up your wallet in the background...\n\n*Quick question to get started:*\n\n🎯 What's your main content niche?\n_(e.g. fitness, tech, finance, beauty, gaming)_`,
      parseMode: "Markdown",
    };
  }

  // Bot onboarding interview — runs for new creators before full agent access
  const onboardingStep = creator.settings?.bot_onboarding_step;
  if (onboardingStep && onboardingStep !== "complete") {
    return await handleBotOnboardingStep(
      creator,
      message.text,
      onboardingStep as number,
      message.platform,
    );
  }

  const normalizedText = message.text.toLowerCase().trim();

  if (
    normalizedText === "/start" ||
    normalizedText === "/help" ||
    normalizedText === "hi" ||
    normalizedText === "hello" ||
    normalizedText === "help"
  ) {
    return {
      text: `👋 Welcome back, ${creator.display_name}! What can I help with?\n\n*Quick Commands:*\n💼 /scan — Find brand deals\n📊 /deals — View deal pipeline\n📅 /calendar — Upcoming deadlines\n💰 /finances — Financial snapshot\n👛 /wallet — Check balance\n📝 /content — Content strategy\n☀️ /brief — Morning brief\n\n*Or just chat with me:*\n"What's my rate for a sponsored post?"\n"Draft a pitch for TechCorp"\n"Show me my analytics"\n\nType /help anytime to see this menu.`,
      parseMode: "Markdown",
    };
  }

  // Rewrite slash commands to natural language for AgentOS routing
  if (
    normalizedText === "/calendar" ||
    normalizedText === "calendar" ||
    normalizedText === "deadlines"
  ) {
    message.text = "show my upcoming deadlines and calendar";
  } else if (
    normalizedText === "/finances" ||
    normalizedText === "finances" ||
    normalizedText === "financial" ||
    normalizedText === "money"
  ) {
    message.text = "give me my financial snapshot";
  } else if (
    normalizedText === "/content" ||
    normalizedText === "content plan" ||
    normalizedText === "content strategy" ||
    normalizedText === "content"
  ) {
    message.text = "generate my content strategy";
  } else if (normalizedText === "/scan") {
    message.text = "scan for brand deals";
  } else if (normalizedText === "/deals") {
    message.text = "show my deal pipeline";
  } else if (normalizedText === "/wallet") {
    message.text = "show my wallet balance";
  } else if (normalizedText === "/brief") {
    message.text = "give me my morning brief";
  }

  const agentResponse = await processCreatorMessage({
    creatorId: creator.id,
    text: message.text,
    metadata: { platform: message.platform },
    walletId: creator.wallet_id,
    walletAddress: creator.wallet_address,
  });

  if (agentResponse.requiresApproval && agentResponse.pendingAction) {
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

  // Add feedback buttons for advice-producing skills
  if (
    agentResponse.skill &&
    FEEDBACK_ELIGIBLE_SKILLS.has(agentResponse.skill)
  ) {
    return {
      text: agentResponse.text,
      parseMode: "Markdown",
      buttons: [
        {
          text: "👍",
          callbackData: `feedback:up:${creator.id}:${agentResponse.skill}`,
        },
        {
          text: "👎 Not quite",
          callbackData: `feedback:down:${creator.id}:${agentResponse.skill}`,
        },
      ],
    };
  }

  return {
    text: agentResponse.text,
    parseMode: "Markdown",
  };
}
