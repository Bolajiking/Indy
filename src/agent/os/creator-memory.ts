/**
 * Creator Memory System
 *
 * Manages persistent, per-creator memory that allows the agent to improve
 * over time. Memories are stored in the DB and injected into skill prompts.
 *
 * Memory types:
 * - preference: How the creator likes things done ("always include rate card in pitches")
 * - pattern: Observed patterns ("brand deals in fitness niche respond best Mon-Wed")
 * - outcome: What happened ("pitched TechCorp at $5k, they countered at $3.5k, accepted")
 * - context: Background context ("creator is building a course, wants recurring brand deals")
 * - learned: What the agent learned from analysis ("creator's audience is 70% female 25-34")
 */

import pino from "#logger";
import {
  upsertCreatorMemory,
  recordSkillOutcome,
  formatMemoriesForPrompt,
  type CreatorMemory,
} from "../../db/queries/creator-memories.js";
import { AGENT } from "../../config/constants.js";
import llm from "../llm.js";

const log = pino({ name: "agent:os:memory" });

/**
 * Load all relevant memories for a skill execution.
 * Returns formatted text ready to inject into a system prompt.
 */
export async function loadMemoryForSkill(
  creatorId: string,
  skill: string,
): Promise<string> {
  try {
    return await formatMemoriesForPrompt(creatorId, skill);
  } catch (err) {
    log.warn({ creatorId, skill, err }, "Failed to load memory for skill");
    return "";
  }
}

/**
 * After a skill runs, extract and persist learnings.
 * This is the self-improvement loop.
 */
export async function extractAndSaveLearnings(params: {
  creatorId: string;
  skill: string;
  input: string;
  output: string;
  success: boolean;
  actionId?: string;
}): Promise<void> {
  const { creatorId, skill, input, output, success, actionId } = params;

  try {
    // Use the configured fast LLM to extract structured learnings from the interaction
    const response = await llm.messages.create({
      model: AGENT.FAST_LLM,
      max_tokens: 1024,
      system: `You are a memory extraction agent. Given an AI agent interaction, extract 1-3 specific, actionable memories about the creator that will help the agent do better next time.

Return ONLY valid JSON:
{
  "memories": [
    {
      "memory_type": "preference|pattern|outcome|context|learned",
      "key": "short_snake_case_key",
      "content": "Specific, factual memory in one sentence",
      "confidence": 0.8
    }
  ],
  "learnings": "One paragraph summary of what was learned from this interaction"
}

Only include memories that are:
1. Specific and factual (not vague)
2. Likely to be useful in future interactions
3. About the creator's preferences, patterns, or context
4. NOT about technical implementation details`,
      messages: [
        {
          role: "user",
          content: `Skill: ${skill}
Success: ${success}
Input: ${input.slice(0, 500)}
Output: ${output.slice(0, 500)}`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";

    let parsed: {
      memories: Array<{
        memory_type: CreatorMemory["memory_type"];
        key: string;
        content: string;
        confidence: number;
      }>;
      learnings: string;
    };

    try {
      // Strip markdown code blocks if present
      const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      log.warn({ skill, text }, "Failed to parse memory extraction response");
      return;
    }

    // Save individual memories
    for (const memory of parsed.memories ?? []) {
      await upsertCreatorMemory(creatorId, {
        memory_type: memory.memory_type,
        skill,
        key: memory.key,
        content: memory.content,
        confidence: memory.confidence,
      });
    }

    // Record the outcome
    await recordSkillOutcome({
      creator_id: creatorId,
      skill,
      action_id: actionId,
      input_summary: input.slice(0, 300),
      output_summary: output.slice(0, 300),
      success,
      learnings: parsed.learnings,
    });

    log.info(
      { creatorId, skill, memoriesCount: parsed.memories?.length ?? 0 },
      "Learnings extracted and saved",
    );
  } catch (err) {
    log.warn({ creatorId, skill, err }, "Failed to extract learnings");
  }
}

/**
 * Capture durable facts a creator shares in conversation as global memories
 * (skill: null) so the agent remembers them across every future interaction.
 * Runs on every message (general + skill paths). Fire-and-forget.
 */
// Zero-token gate: only spend an extraction call when the message could plausibly
// contain a durable fact. Skips commands, approvals, quick prompts, and one-liners
// (which never carry reusable context) so we don't burn tokens on every message.
const TRIVIAL_PREFIXES = [
  "scan",
  "check my",
  "plan my",
  "show",
  "my deals",
  "my rate",
  "my wallet",
  "approve",
  "skip",
  "yes",
  "no",
  "brief",
  "content plan",
  "calendar",
  "finances",
  "what should i charge",
  "draft a",
  "connect ",
  "disconnect ",
];

function isWorthRemembering(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 20) return false; // "ok", "approve", "scan for deals"
  if (TRIVIAL_PREFIXES.some((p) => t === p || t.startsWith(p))) return false;
  // Needs a first-person statement to carry a durable fact about the creator.
  return /\b(i|i'm|im|my|we|we're|our|me)\b/.test(t);
}

export async function rememberCreatorContext(params: {
  creatorId: string;
  userText: string;
  agentText: string;
}): Promise<void> {
  const { creatorId, userText, agentText } = params;
  if (!isWorthRemembering(userText)) return;

  try {
    const response = await llm.messages.create({
      model: AGENT.FAST_LLM,
      max_tokens: 320,
      system: `You extract DURABLE facts a content creator shares about themselves, so an AI business manager can remember them long-term.

Return ONLY valid JSON: { "memories": [ { "memory_type": "preference|context|outcome|pattern|learned", "key": "short_snake_case_key", "content": "one factual sentence", "confidence": 0.8 } ] }

Extract a memory ONLY when the creator states something durable and reusable, such as:
- profile/identity (niche, platforms, audience size, location, brand name)
- rates, pricing, financial goals, monthly targets
- preferences (tone, how they want pitches/replies written, brands they will/won't work with)
- ongoing context (launching a course, exclusivity deals, deadlines that recur)
- relationships (brands/contacts they work with)

Do NOT extract: transient requests, questions, one-off tasks, agent implementation details, or anything not durably useful later. If nothing durable was shared, return { "memories": [] }.`,
      messages: [
        {
          role: "user",
          content: `Creator said: ${userText.slice(0, 1200)}\n\nAssistant replied: ${agentText.slice(0, 600)}`,
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    let parsed: {
      memories?: Array<{
        memory_type: CreatorMemory["memory_type"];
        key: string;
        content: string;
        confidence?: number;
      }>;
    };
    try {
      parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    } catch {
      return;
    }

    for (const memory of parsed.memories ?? []) {
      if (!memory.key || !memory.content) continue;
      await upsertCreatorMemory(creatorId, {
        memory_type: memory.memory_type ?? "context",
        skill: null, // global — applies across all interactions
        key: memory.key,
        content: memory.content,
        confidence: memory.confidence ?? 0.8,
      });
    }

    if ((parsed.memories?.length ?? 0) > 0) {
      log.info(
        { creatorId, count: parsed.memories?.length },
        "Saved creator context memories",
      );
    }
  } catch (err) {
    log.warn({ creatorId, err }, "Failed to remember creator context");
  }
}

/**
 * Save explicit creator feedback as a high-confidence memory.
 */
export async function saveCreatorFeedback(
  creatorId: string,
  skill: string,
  feedback: string,
): Promise<void> {
  const key = `feedback_${Date.now()}`;
  // Positive feedback: 0.7 (reinforcement signal, not absolute truth)
  // Negative/correction feedback: 0.9 (strong signal — creator explicitly told us we were wrong)
  const confidence = feedback.includes("👎") ? 0.9 : 0.7;
  await upsertCreatorMemory(creatorId, {
    memory_type: "preference",
    skill,
    key,
    content: feedback,
    confidence,
  });
}
