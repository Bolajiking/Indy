import { AGENT } from "../config/constants.js";
import { assembleContext, getRecentMessages } from "./memory.js";
import { createMppClient, getOnChainBalance } from "../wallet/mpp.js";
import { canAffordTransaction } from "../wallet/spending.js";
import { resolveWalletForCreator } from "../wallet/privy.js";
import { getCreatorById, deductCredits } from "../db/queries/creators.js";
import { maybeSendLowCreditAlert } from "../messaging/notify.js";
import { runAgentLoop } from "./loop.js";
import type { AgentLoopResult } from "./loop.js";
import pino from "pino";

import "./tools/enrichment.js";
import "./tools/web-search.js";
import "./tools/email-sender.js";
import "./tools/platform-analytics.js";
import "./tools/media-kit-generator.js";
import "./tools/browser.js";
import "./tools/run-skill.js";
import "./tools/deal-manager.js";
import { findService } from "./tools/x402-registry.js";

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
- search_web: Web search for research
- get_platform_analytics: Pull social media data
- generate_media_kit: Create visual media kits
- send_email: Send pitches/emails (requires approval)
- enrich_brand_data: Enrich brand data via x402
- create_deal: Save a brand opportunity to the creator's pipeline (use whenever a deal/opportunity is identified)
- update_deal_stage: Move a deal to a new stage and record pitch text, responses, or contract notes

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
- ALWAYS call update_deal_stage when a deal's status changes (pitch sent, response received, etc.)`;

export interface AgentResponse {
  text: string;
  requiresApproval: boolean;
  skill?: string;
  pendingAction?: {
    id: string;
    type: string;
    description: string;
    input: Record<string, unknown>;
    toolUseId?: string;
    messageHistory?: import("@anthropic-ai/sdk").Anthropic.MessageParam[];
    systemPrompt?: string;
  };
}

export async function runAgent(
  creatorId: string,
  userMessage: string,
  walletId?: string,
  walletAddress?: string
): Promise<AgentResponse> {
  log.info({ creatorId, message: userMessage.slice(0, 100) }, "Agent invoked");

  // Check credit balance before running
  const creator = await getCreatorById(creatorId);
  if (creator && creator.free_credits_remaining_cents <= 0) {
    log.warn({ creatorId }, "Creator has no credits remaining");
    return {
      text: "You've used all your free credits. Top up your wallet to keep using Indyfren's paid features. You can still use free commands like \"calendar\", \"finances\", and \"content plan\".",
      requiresApproval: false,
    };
  }

  const context = await assembleContext(creatorId);

  let toolContext = null;
  if (walletId && walletAddress) {
    const wallet = await resolveWalletForCreator(creatorId, walletId, walletAddress);
    if (wallet) {
      // Pre-flight: check combined credits + wallet balance before starting any paid work.
      // Apply a 7s timeout — a hung RPC node should not block the entire agent run.
      try {
        const balancePromise = getOnChainBalance(wallet.address);
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Balance check timed out")), 7_000)
        );
        const { balanceCents } = await Promise.race([balancePromise, timeout]);
        const freeCredits = creator?.free_credits_remaining_cents ?? 0;
        const afford = canAffordTransaction(
          AGENT.MIN_TASK_COST_CENTS,
          freeCredits,
          balanceCents
        );
        if (!afford.canAfford) {
          const shortfallDollars = (afford.shortfall / 100).toFixed(2);
          log.warn({ creatorId, shortfall: afford.shortfall }, "Creator cannot afford task");
          return {
            text: `Your account needs $${shortfallDollars} more to run paid actions. Add USDC to your wallet (${wallet.address}) or wait for your free credits to reset.`,
            requiresApproval: false,
          };
        }
      } catch (err) {
        // Balance check failed (network issue) — proceed; individual tool calls will catch failures
        log.warn({ err, creatorId }, "Pre-flight balance check failed — proceeding");
      }

      const mppClient = await createMppClient(
        creatorId,
        wallet.walletId,
        wallet.address as `0x${string}`
      );
      toolContext = { creatorId, mppFetch: mppClient.fetch, findService };
    }
  }

  // Load conversation history for continuity
  const recentMessages = await getRecentMessages(creatorId);

  const messages: any[] = [];

  if (recentMessages.length > 0) {
    messages.push({
      role: "user",
      content: `<creator_context>\n${context}\n</creator_context>\n\n${recentMessages[0].content}`,
    });
    for (let i = 1; i < recentMessages.length; i++) {
      const msg = recentMessages[i];
      const lastRole = messages[messages.length - 1].role;
      if (msg.role === lastRole) continue;
      messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
    }
    const lastRole = messages[messages.length - 1].role;
    if (lastRole === "user") {
      const last = messages[messages.length - 1];
      messages[messages.length - 1] = { role: "user", content: `${last.content}\n\n${userMessage}` };
    } else {
      messages.push({ role: "user", content: userMessage });
    }
  } else {
    messages.push({
      role: "user",
      content: `<creator_context>\n${context}\n</creator_context>\n\n${userMessage}`,
    });
  }

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
  });

  // Deduct credits for tool usage and alert if balance is low
  if (totalCostCents > 0) {
    try {
      const updatedCreator = await deductCredits(creatorId, totalCostCents);
      log.info({ creatorId, costCents: totalCostCents }, "Credits deducted");
      maybeSendLowCreditAlert(creatorId, updatedCreator.free_credits_remaining_cents).catch(
        () => {}
      );
    } catch (err) {
      log.warn({ creatorId, costCents: totalCostCents, error: err }, "Failed to deduct credits");
    }
  }

  return result;
}
