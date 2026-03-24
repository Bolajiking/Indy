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

import pino from "pino";
import {
  getCreatorMemories,
  upsertCreatorMemory,
  recordSkillOutcome,
  formatMemoriesForPrompt,
  type CreatorMemory,
} from "../../db/queries/creator-memories.js";
import { AGENT } from "../../config/constants.js";
import anthropic from "../anthropic.js";

const log = pino({ name: "agent:os:memory" });

export { getCreatorMemories, upsertCreatorMemory, recordSkillOutcome };

/**
 * Load all relevant memories for a skill execution.
 * Returns formatted text ready to inject into a system prompt.
 */
export async function loadMemoryForSkill(
  creatorId: string,
  skill: string
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
    // Use Claude to extract structured learnings from the interaction
    const response = await anthropic.messages.create({
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
      "Learnings extracted and saved"
    );
  } catch (err) {
    log.warn({ creatorId, skill, err }, "Failed to extract learnings");
  }
}

/**
 * Save explicit creator feedback as a high-confidence memory.
 */
export async function saveCreatorFeedback(
  creatorId: string,
  skill: string,
  feedback: string
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
