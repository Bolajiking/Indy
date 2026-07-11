import { AGENT } from "../config/constants.js";
import {
  assembleContext,
  buildConversationMessages,
  getRecentMessages,
} from "./memory.js";
import {
  createMppClient,
  getOnChainBalanceWithTimeout,
} from "../wallet/mpp.js";
import { canAffordTransaction } from "../wallet/spending.js";
import { formatUsd } from "../lib/format.js";
import { resolveWalletForCreator } from "../wallet/privy.js";
import { getCreatorById, deductCredits } from "../db/queries/creators.js";
import { maybeSendLowCreditAlert } from "../messaging/notify.js";
import { runAgentLoop } from "./loop.js";
import pino from "#logger";

import "./tools/enrichment.js";
import "./tools/web-search.js";
import "./tools/email-sender.js";
import "./tools/platform-analytics.js";
import "./tools/media-kit-generator.js";
import "./tools/browser.js";
import "./tools/run-skill.js";
import "./tools/deal-manager.js";
import "./tools/connection-manager.js";
import { findService } from "./tools/x402-registry.js";
import { composioLoopTools } from "../integrations/composio.js";
import {
  ACCURACY_DIRECTIVE,
  CONTEXT_AWARENESS_DIRECTIVE,
  channelNote,
} from "./prompts.js";
import type { AgentChannel, AgentResponse } from "./types.js";

const log = pino({ name: "agent:orchestrator" });

const SYSTEM_PROMPT = `You are Indyfren, an AI business manager for independent content creators. Your #1 job is helping creators make more money.

## How to Handle Every Message

Before you respond to anything, do this internally:

1. **Extract the real intent** — What is this creator actually asking for or telling you? Do not take messages at face value or respond to them as literal strings. Parse the meaning. "check my deals" means give a full pipeline status update. "how am I doing" means give a real financial and momentum assessment. "I got a reply from Nike" means extract every detail from that reply — brand name, what they said, implied next step, tone, urgency — and act on it. "plan my day" means look at their actual deals, deadlines, and context and build a real plan.

2. **Parse all information passed** — If the creator pastes or describes something (an email reply, a contract clause, a brand offer, a message from someone), extract every piece of structured information from it: who, what amount, what terms, what stage, what next action is needed. Never echo it back verbatim. Synthesize it, evaluate it, and tell the creator what it means for them.

3. **Cross-reference their situation** — Map what they said against their current deals, platforms, wallet balance, and conversation history. A question about a deal should pull that specific deal's details. A mention of a brand should check if you already have a deal with them.

4. **Respond to the actual need, not the surface ask** — If they say "is this deal good?" they want your honest professional judgment with specific reasons. If they say "what should I do next?" they want a concrete prioritized action list, not a generic answer. If they describe a problem, they want a solution.

5. **Never be a bot** — Never just acknowledge and repeat back what they said. Add value: analysis, a decision, a next step, a warning, a recommendation. Every response should move something forward.

## Your Capabilities
You have 12 specialized skill sub-agents. Use the run_skill tool to delegate to the right one:
- brand-deal-scanner: Find brand opportunities, scan deal platforms
- rate-calculator: Calculate fair rates, build rate cards
- pitch-generator: Write pitch emails to brands
- contract-reviewer: Review deals, flag unfavorable terms
- revenue-advisor: Revenue diversification, new income streams
- financial-tracker: Financial snapshots, income/expense tracking
- morning-brief: Daily brief with priorities and actions
- analytics-aggregator: Cross-platform social media analytics
- content-strategy: Content plans, calendars, ideas
- inbox-triager: Email triage, prioritization, drafts
- calendar-manager: Deadlines, schedules, deal milestones
- seo-optimizer: SEO for YouTube, Instagram, TikTok

You also have direct tools:
- browse_web: Research brands, scrape deal platforms
- web_search: Web search for research
- send_email: Send pitches/emails (requires approval)
- create_deal: Save a brand opportunity to the creator's pipeline (use whenever a deal/opportunity is identified)
- update_deal_stage: Move a deal to a new stage and record pitch text, responses, or contract notes
- request_connections: Surface inline "Continue to …" connect cards in chat when the creator asks to connect/link/authorize an account or channel
- use_tool: Runs the occasional tools — generate_media_kit (visual media kits), enrich_brand (brand/contact data), get_platform_analytics (native social stats), disconnect_connections (revoke an app). Call use_tool with the tool name and its arguments.

## Your Personality
- Direct, no-BS, results-oriented
- Talk like a savvy business manager, not a corporate bot
- Celebrate wins, be honest about challenges
- Keep messages concise — creators are busy

## Rules
- NEVER make financial commitments without creator approval
- NEVER send pitches without creator approval
- Always explain what you're doing and why
- If a task costs money (uses paid APIs), mention the cost
- When showing deals, include fit score and estimated value
- Prefer run_skill for specialized tasks — skill sub-agents are better at their domain
- ALWAYS call create_deal when you identify a brand opportunity — never just list deals as text without saving them
- ALWAYS call update_deal_stage when a deal's status changes (pitch sent, response received, etc.)
- BEFORE calling create_deal, check the Active Deals list in context. If the brand name is already listed there (even with different casing), call update_deal_stage instead — NEVER create a duplicate entry for a brand already in the pipeline
- When the creator asks to connect, link, or authorize an account or channel (e.g. "connect my YouTube and Telegram"), call request_connections with those services. This surfaces secure connect cards in the chat — do NOT tell them to go to Settings to do it manually. After calling it, briefly confirm what you've surfaced and that they should complete the prompts.
- If the creator has connected apps (Gmail, Slack, etc.), their tools appear in your tool list (named like GMAIL_SEND_EMAIL) — use them to act on the creator's behalf. If they ask to do something that needs an app they have NOT connected, call request_connections for that app first, then act once connected.
- When the creator asks to disconnect, unlink, or revoke an app, call use_tool with disconnect_connections and those services, then confirm what was disconnected.

${ACCURACY_DIRECTIVE}

${CONTEXT_AWARENESS_DIRECTIVE}`;

export type { AgentResponse } from "./types.js";

export async function runAgent(
  creatorId: string,
  userMessage: string,
  walletId?: string,
  walletAddress?: string,
  channel?: AgentChannel,
): Promise<AgentResponse> {
  log.info({ creatorId, message: userMessage.slice(0, 100) }, "Agent invoked");

  // Check credit balance before running
  const creator = await getCreatorById(creatorId);
  if (creator && creator.free_credits_remaining_cents <= 0) {
    log.warn({ creatorId }, "Creator has no credits remaining");
    return {
      text: 'You\'ve used all your free credits, so I held off on paid work. Add USDC on the dashboard Wallet page and I\'ll pick this right back up. Meanwhile everything free still works — try "show my deals", "calendar", "finances", or "content plan" and I\'ll run them now.',
      requiresApproval: false,
    };
  }

  const context = await assembleContext(creatorId);

  let toolContext = null;
  if (walletId && walletAddress) {
    const wallet = await resolveWalletForCreator(
      creatorId,
      walletId,
      walletAddress,
    );
    if (wallet) {
      // Pre-flight: check combined credits + wallet balance before starting any paid work.
      // Apply a 7s timeout — a hung RPC node should not block the entire agent run.
      try {
        const { balanceCents } = await getOnChainBalanceWithTimeout(
          wallet.address,
        );
        const freeCredits = creator?.free_credits_remaining_cents ?? 0;
        const afford = canAffordTransaction(
          AGENT.MIN_TASK_COST_CENTS,
          freeCredits,
          balanceCents,
        );
        if (!afford.canAfford) {
          log.warn(
            { creatorId, shortfall: afford.shortfall },
            "Creator cannot afford task",
          );
          return {
            text: `This needs paid tools and your balance is ${formatUsd(afford.shortfall)} short. Top up on the dashboard Wallet page (your address: ${wallet.address}) and ask me again — I'll run it immediately. Anything free (deals, calendar, finances, content plans) I can still do right now.`,
            requiresApproval: false,
          };
        }
      } catch (err) {
        // Balance check failed (network issue) — proceed; individual tool calls will catch failures
        log.warn(
          { err, creatorId },
          "Pre-flight balance check failed — proceeding",
        );
      }

      const mppClient = await createMppClient(
        creatorId,
        wallet.walletId,
        wallet.address as `0x${string}`,
      );
      toolContext = { creatorId, mppFetch: mppClient.fetch, findService };
    }
  }

  // Load conversation history for continuity
  const recentMessages = await getRecentMessages(creatorId);
  const messages = buildConversationMessages(
    context,
    recentMessages,
    userMessage,
  );

  // Connected-app tools (Gmail, Calendar, …) the creator has authorized via Composio.
  const composio = await composioLoopTools(creatorId);

  let totalCostCents = 0;
  const result = await runAgentLoop({
    systemPrompt: SYSTEM_PROMPT,
    messages,
    toolContext,
    creatorId,
    maxSteps: AGENT.MAX_STEPS_PER_TASK,
    onToolUsed: (_toolName, costCents) => {
      totalCostCents += costCents;
    },
    ...composio,
    systemPromptSuffix: `${composio.systemPromptSuffix ?? ""}${channelNote(channel)}`,
  });

  // Deduct credits for tool usage and alert if balance is low
  if (totalCostCents > 0) {
    try {
      const updatedCreator = await deductCredits(creatorId, totalCostCents);
      log.info({ creatorId, costCents: totalCostCents }, "Credits deducted");
      maybeSendLowCreditAlert(
        creatorId,
        updatedCreator.free_credits_remaining_cents,
      ).catch((alertErr) => {
        log.warn(
          { err: alertErr, creatorId },
          "Failed to send low credit alert",
        );
      });
    } catch (err) {
      log.warn(
        { creatorId, costCents: totalCostCents, error: err },
        "Failed to deduct credits",
      );
    }
  }

  return result;
}
