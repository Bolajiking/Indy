/**
 * Executes skill-specific agent runs.
 *
 * Each skill exports:
 *   - systemPromptSuffix: string  (specialized expert persona / instructions)
 *   - fallbackMessage?: string    (shown when the LLM returns empty output)
 *
 * This file loads the skill doc, creator memory, wallet context, and dynamic
 * connected-app tools before entering the shared tool-use loop.
 */

import pino from "pino";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  loadMemoryForSkill,
  extractAndSaveLearnings,
} from "./creator-memory.js";
import type { SkillName } from "./router.js";
import type { AgentChannel, AgentResponse } from "../types.js";
import {
  assembleContext,
  buildConversationMessages,
  getRecentMessages,
} from "../memory.js";
import { createMppClient } from "../../wallet/mpp.js";
import { resolveWalletForCreator } from "../../wallet/privy.js";
import { runAgentLoop } from "../loop.js";
import {
  ACCURACY_DIRECTIVE,
  CONTEXT_AWARENESS_DIRECTIVE,
  channelNote,
} from "../prompts.js";
import { composioLoopTools } from "../../integrations/composio.js";
import type { ToolContext } from "../tools/registry.js";
import { findService } from "../tools/x402-registry.js";
import { createDeal } from "../../db/queries/deals.js";
import { AGENT } from "../../config/constants.js";
import llm from "../llm.js";
import { errMsg } from "../../lib/errors.js";

const log = pino({ name: "agent:os:skill-runner" });
const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SkillRunInput {
  creatorId: string;
  skill: SkillName;
  userMessage: string;
  extractedParams: Record<string, string>;
  walletId?: string;
  walletAddress?: string;
  channel?: AgentChannel;
}

/**
 * Load a skill's knowledge doc (skill.md) as a string.
 */
function loadSkillDoc(skill: SkillName): string {
  try {
    const skillPath = join(__dirname, "skills", skill, "skill.md");
    return readFileSync(skillPath, "utf-8");
  } catch (err) {
    log.warn({ err, skill }, "Failed to load skill doc; using default prompt");
    return `You are a specialized ${skill} agent for Indyfren.`;
  }
}

interface ExtractedDeal {
  brand_name: string;
  fit_score: number;
  estimated_value_cents: number;
  notes?: string;
  source?: string;
  source_url?: string;
  source_evidence?: string;
  confidence?: number;
  dedupe_key?: string;
}

interface DealFallbackResult {
  saved: number;
  rejected: number;
  errors: string[];
}

type ValidExtractedDeal = Required<ExtractedDeal>;
type ExtractedDealValidation =
  | { ok: true; deal: ValidExtractedDeal }
  | { ok: false; error: string };

function buildDealDedupeKey(brandName: string, sourceUrl: string): string {
  return `${brandName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}|${sourceUrl.trim()}`;
}

function validateExtractedDeal(deal: ExtractedDeal): ExtractedDealValidation {
  if (!deal.brand_name || !deal.fit_score || !deal.estimated_value_cents) {
    return {
      ok: false,
      error: `Rejected ${deal.brand_name ?? "unknown brand"}: brand_name, fit_score, and estimated_value_cents are required`,
    };
  }

  if (
    !deal.source_url ||
    !/^https?:\/\//i.test(deal.source_url) ||
    !deal.source_evidence ||
    typeof deal.confidence !== "number" ||
    deal.confidence < 0 ||
    deal.confidence > 1
  ) {
    return {
      ok: false,
      error: `Rejected ${deal.brand_name}: source_url, source_evidence, and confidence are required before saving`,
    };
  }

  return {
    ok: true,
    deal: {
      brand_name: deal.brand_name,
      fit_score: deal.fit_score,
      estimated_value_cents: deal.estimated_value_cents,
      notes: deal.notes ?? "",
      source: deal.source ?? "extraction_fallback",
      source_url: deal.source_url,
      source_evidence: deal.source_evidence,
      confidence: deal.confidence,
      dedupe_key:
        deal.dedupe_key ?? buildDealDedupeKey(deal.brand_name, deal.source_url),
    },
  };
}

/**
 * Fallback: when brand-deal-scanner responds with deal info but didn't call create_deal,
 * use the configured fast LLM to extract structured deal data from the response text and save it.
 */
async function saveDealsFallback(
  creatorId: string,
  responseText: string,
): Promise<DealFallbackResult> {
  log.info({ creatorId }, "Running deal extraction fallback");
  const fallbackResult: DealFallbackResult = {
    saved: 0,
    rejected: 0,
    errors: [],
  };
  try {
    const extraction = await llm.messages.create({
      model: AGENT.FAST_LLM,
      max_tokens: 1024,
      system:
        'Extract brand deal opportunities from the text. Return ONLY valid JSON: { "deals": [ { "brand_name": string, "fit_score": number (1-100), "estimated_value_cents": number, "notes": string, "source": string, "source_url": string, "source_evidence": string, "confidence": number (0-1), "dedupe_key": string } ] }. Only include deals with source evidence present in the text. If no sourced deals found, return { "deals": [] }.',
      messages: [{ role: "user", content: responseText }],
    });

    const textBlock = extraction.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      fallbackResult.errors.push("No extraction text returned");
      return fallbackResult;
    }

    let parsed: { deals: ExtractedDeal[] };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      // Try to extract JSON from surrounding text
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (!match) {
        fallbackResult.errors.push("Extraction response did not contain JSON");
        return fallbackResult;
      }
      parsed = JSON.parse(match[0]);
    }

    const deals = parsed?.deals ?? [];
    for (const deal of deals) {
      const validated = validateExtractedDeal(deal);
      if (!validated.ok) {
        fallbackResult.rejected++;
        fallbackResult.errors.push(validated.error);
        continue;
      }
      const sourcedDeal = validated.deal;
      await createDeal({
        creator_id: creatorId,
        brand_name: sourcedDeal.brand_name,
        fit_score: sourcedDeal.fit_score,
        estimated_value_cents: sourcedDeal.estimated_value_cents,
        brand_contact_email: null,
        brand_contact_name: null,
        notes: sourcedDeal.notes || null,
        metadata: {
          source: sourcedDeal.source,
          sourceUrl: sourcedDeal.source_url,
          sourceEvidence: sourcedDeal.source_evidence,
          confidence: sourcedDeal.confidence,
          dedupeKey: sourcedDeal.dedupe_key,
        },
      });
      fallbackResult.saved++;
      log.info(
        { creatorId, brand: sourcedDeal.brand_name },
        "Saved deal via extraction fallback",
      );
    }
  } catch (err: unknown) {
    log.warn({ err: errMsg(err) }, "Deal extraction fallback error");
    fallbackResult.errors.push(errMsg(err));
  }

  return fallbackResult;
}

/**
 * Dynamically import and run a skill sub-agent.
 */
export async function runSkill(input: SkillRunInput): Promise<AgentResponse> {
  const { creatorId, skill, userMessage, walletId, walletAddress, channel } =
    input;

  log.info({ creatorId, skill }, "Running skill sub-agent");
  const startTime = Date.now();

  // Load skill knowledge + creator memory + creator context + conversation
  // history in parallel. History gives skill runs the same continuity the
  // general orchestrator has (e.g. "scan again but for fitness brands").
  const [skillDoc, memoryContext, creatorContext, recentMessages] =
    await Promise.all([
      Promise.resolve(loadSkillDoc(skill)),
      loadMemoryForSkill(creatorId, skill),
      assembleContext(creatorId),
      getRecentMessages(creatorId),
    ]);

  // Resolve wallet tool context
  let toolContext: ToolContext | null = null;
  if (walletId && walletAddress) {
    try {
      const wallet = await resolveWalletForCreator(
        creatorId,
        walletId,
        walletAddress,
      );
      if (wallet) {
        const mppClient = await createMppClient(
          creatorId,
          wallet.walletId,
          wallet.address as `0x${string}`,
        );
        toolContext = {
          creatorId,
          mppFetch: mppClient.fetch,
          findService,
          activeSkill: skill,
        };
      }
    } catch (err) {
      log.warn({ err, creatorId }, "Failed to resolve wallet for skill");
    }
  }

  try {
    // Load skill module — expects: { systemPromptSuffix: string, fallbackMessage?: string }
    const skillModule = await import(`./skills/${skill}/agent.js`).catch(
      (err) => {
        log.warn(
          { err, skill },
          "Failed to load skill module; using default skill behavior",
        );
        return null;
      },
    );

    const systemPromptSuffix: string = skillModule?.systemPromptSuffix ?? "";
    const base = systemPromptSuffix
      ? `${skillDoc}\n\n${memoryContext}\n\n${systemPromptSuffix}`
      : `${skillDoc}\n\n${memoryContext}`;
    // Every skill inherits the shared accuracy and context-awareness
    // directives so it never fabricates data and never dead-ends the creator
    // over a missing prerequisite (it guides them to the unlocking action).
    const systemPrompt = `${base}\n\n${ACCURACY_DIRECTIVE}\n\n${CONTEXT_AWARENESS_DIRECTIVE}`;

    // Connected-app tools (Gmail, Calendar, …) so skill sub-agents — e.g.
    // inbox-triager handling "summarize my emails" — can act on connections too.
    const composio = await composioLoopTools(creatorId);

    const result = await runAgentLoop({
      systemPrompt,
      messages: buildConversationMessages(
        creatorContext,
        recentMessages,
        userMessage,
      ),
      toolContext,
      creatorId,
      activeSkill: skill,
      maxSteps: 10,
      ...composio,
      systemPromptSuffix: `${composio.systemPromptSuffix ?? ""}${channelNote(channel)}`,
    });

    // Tag the response with the skill that produced it
    result.skill = skill;

    // Fallback: if brand-deal-scanner didn't call create_deal, extract deals from text and save them
    if (
      skill === "brand-deal-scanner" &&
      !result.requiresApproval &&
      result.text.length > 50 &&
      !result.toolCallNames?.includes("create_deal")
    ) {
      // Await the fallback so deals are in the DB before the API response returns,
      // ensuring the dashboard refresh triggered by the client always finds the new deals.
      const fallback = await saveDealsFallback(creatorId, result.text).catch(
        (err) => {
          log.warn({ err }, "Deal extraction fallback failed");
          return {
            saved: 0,
            rejected: 0,
            errors: [
              err instanceof Error
                ? err.message
                : "Deal extraction fallback failed",
            ],
          };
        },
      );
      if (fallback.saved === 0) {
        result.text = `${result.text}\n\nNo deal was saved to your pipeline yet — I only save opportunities I can verify with a concrete source. Want me to dig deeper on any of these?`;
      }
    }

    const duration = Date.now() - startTime;
    log.info(
      { creatorId, skill, duration, success: !result.requiresApproval },
      "Skill completed",
    );

    // Fire-and-forget: extract learnings (only for substantive successful outputs)
    if (!result.requiresApproval && result.text.length > 300) {
      extractAndSaveLearnings({
        creatorId,
        skill,
        input: userMessage,
        output: result.text,
        success: true,
      }).catch((err) => log.warn({ err }, "Failed to save learnings"));
    }

    return result;
  } catch (err: unknown) {
    log.error(
      { creatorId, skill, error: errMsg(err) },
      "Skill execution failed",
    );

    extractAndSaveLearnings({
      creatorId,
      skill,
      input: userMessage,
      output: `Error: ${errMsg(err)}`,
      success: false,
    }).catch((learningErr) => {
      log.warn(
        { err: learningErr, creatorId, skill },
        "Failed to save failed skill learning",
      );
    });

    return {
      text: `I ran into an issue with the ${skill} skill. Let me try a different approach — just ask me again.`,
      requiresApproval: false,
    };
  }
}
