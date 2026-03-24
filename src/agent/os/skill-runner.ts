/**
 * Agentic OS Skill Runner
 *
 * Generic executor for all skill sub-agents. Each skill exports only:
 *   - systemPromptSuffix: string  (specialized expert persona / instructions)
 *   - fallbackMessage?: string    (shown when Claude returns empty output)
 *
 * This file owns the full tool-use loop — skills are thin wrappers.
 */

import pino from "pino";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadMemoryForSkill, extractAndSaveLearnings } from "./creator-memory.js";
import type { SkillName } from "./router.js";
import type { AgentResponse } from "../orchestrator.js";
import { assembleContext } from "../memory.js";
import { createMppClient } from "../../wallet/mpp.js";
import { resolveWalletForCreator } from "../../wallet/privy.js";
import { runAgentLoop } from "../loop.js";
import type { ToolContext } from "../tools/registry.js";
import { findService } from "../tools/x402-registry.js";
import { createDeal } from "../../db/queries/deals.js";
import anthropic from "../anthropic.js";

const log = pino({ name: "agent:os:skill-runner" });
const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SkillRunInput {
  creatorId: string;
  skill: SkillName;
  userMessage: string;
  extractedParams: Record<string, string>;
  walletId?: string;
  walletAddress?: string;
}

/**
 * Load a skill's knowledge doc (skill.md) as a string.
 */
function loadSkillDoc(skill: SkillName): string {
  try {
    const skillPath = join(__dirname, "skills", skill, "skill.md");
    return readFileSync(skillPath, "utf-8");
  } catch {
    return `You are a specialized ${skill} agent for Indyfren.`;
  }
}


interface ExtractedDeal {
  brand_name: string;
  fit_score: number;
  estimated_value_cents: number;
  notes?: string;
}

/**
 * Fallback: when brand-deal-scanner responds with deal info but didn't call create_deal,
 * use Claude to extract structured deal data from the response text and save it.
 */
async function saveDealsFallback(creatorId: string, responseText: string): Promise<void> {
  log.info({ creatorId }, "Running deal extraction fallback");
  try {
    const extraction = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system:
        "Extract brand deal opportunities from the text. Return ONLY valid JSON: { \"deals\": [ { \"brand_name\": string, \"fit_score\": number (1-100), \"estimated_value_cents\": number, \"notes\": string } ] }. If no deals found, return { \"deals\": [] }.",
      messages: [{ role: "user", content: responseText }],
    });

    const textBlock = extraction.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return;

    let parsed: { deals: ExtractedDeal[] };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      // Try to extract JSON from surrounding text
      const match = textBlock.text.match(/\{[\s\S]*\}/);
      if (!match) return;
      parsed = JSON.parse(match[0]);
    }

    const deals = parsed?.deals ?? [];
    for (const deal of deals) {
      if (!deal.brand_name || !deal.fit_score || !deal.estimated_value_cents) continue;
      await createDeal({
        creator_id: creatorId,
        brand_name: deal.brand_name,
        fit_score: deal.fit_score,
        estimated_value_cents: deal.estimated_value_cents,
        brand_contact_email: null,
        brand_contact_name: null,
        notes: deal.notes ?? null,
        metadata: { source: "extraction_fallback" },
      });
      log.info({ creatorId, brand: deal.brand_name }, "Saved deal via extraction fallback");
    }
  } catch (err: any) {
    log.warn({ err: err.message }, "Deal extraction fallback error");
  }
}

/**
 * Dynamically import and run a skill sub-agent.
 */
export async function runSkill(input: SkillRunInput): Promise<AgentResponse> {
  const { creatorId, skill, userMessage, walletId, walletAddress } = input;

  log.info({ creatorId, skill }, "Running skill sub-agent");
  const startTime = Date.now();

  // Load skill knowledge + creator memory + creator context in parallel
  const [skillDoc, memoryContext, creatorContext] = await Promise.all([
    Promise.resolve(loadSkillDoc(skill)),
    loadMemoryForSkill(creatorId, skill),
    assembleContext(creatorId),
  ]);

  // Resolve wallet tool context
  let toolContext: ToolContext | null = null;
  if (walletId && walletAddress) {
    try {
      const wallet = await resolveWalletForCreator(creatorId, walletId, walletAddress);
      if (wallet) {
        const mppClient = await createMppClient(
          creatorId,
          wallet.walletId,
          wallet.address as `0x${string}`
        );
        toolContext = { creatorId, mppFetch: mppClient.fetch, findService };
      }
    } catch (err) {
      log.warn({ err, creatorId }, "Failed to resolve wallet for skill");
    }
  }

  try {
    // Load skill module — expects: { systemPromptSuffix: string, fallbackMessage?: string }
    const skillModule = await import(`./skills/${skill}/agent.js`).catch(() => null);

    const systemPromptSuffix: string = skillModule?.systemPromptSuffix ?? "";
    const fallbackMessage: string =
      skillModule?.fallbackMessage ?? "I wasn't able to complete that. Please try again.";

    const systemPrompt = systemPromptSuffix
      ? `${skillDoc}\n\n${memoryContext}\n\n${systemPromptSuffix}`
      : `${skillDoc}\n\n${memoryContext}`;

    const result = await runAgentLoop({
      systemPrompt,
      messages: [
        {
          role: "user",
          content: `<creator_context>\n${creatorContext}\n</creator_context>\n\n${userMessage}`,
        },
      ],
      toolContext,
      creatorId,
      maxSteps: 10,
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
      await saveDealsFallback(creatorId, result.text).catch((err) =>
        log.warn({ err }, "Deal extraction fallback failed")
      );
    }

    const duration = Date.now() - startTime;
    log.info({ creatorId, skill, duration, success: !result.requiresApproval }, "Skill completed");

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
  } catch (err: any) {
    log.error({ creatorId, skill, error: err.message }, "Skill execution failed");

    extractAndSaveLearnings({
      creatorId,
      skill,
      input: userMessage,
      output: `Error: ${err.message}`,
      success: false,
    }).catch(() => {});

    return {
      text: `I ran into an issue with the ${skill} skill. Let me try a different approach — just ask me again.`,
      requiresApproval: false,
    };
  }
}
