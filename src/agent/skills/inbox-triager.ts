import pino from "#logger";
import { AGENT } from "../../config/constants.js";
import llm from "../llm.js";

const log = pino({ name: "skill:inbox-triager" });

export interface TriagedMessage {
  originalText: string;
  category:
    | "brand_deal"
    | "collaboration"
    | "fan_mail"
    | "spam"
    | "urgent"
    | "general";
  priority: "high" | "medium" | "low";
  suggestedAction: string;
  brandMentioned?: string;
  requiresResponse: boolean;
}

export interface TriageResult {
  messages: TriagedMessage[];
  summary: string;
  actionRequired: number;
}

/**
 * Categorize and prioritize a batch of incoming messages/DMs
 * for the creator. Uses the configured fast LLM for classification.
 */
export async function triageMessages(
  creatorId: string,
  messages: Array<{ from: string; text: string; platform?: string }>,
): Promise<TriageResult> {
  log.info({ creatorId, count: messages.length }, "Triaging messages");

  if (messages.length === 0) {
    return {
      messages: [],
      summary: "No messages to triage.",
      actionRequired: 0,
    };
  }

  const messageList = messages
    .map(
      (m, i) =>
        `[${i + 1}] From: ${m.from} (${m.platform ?? "unknown"})\n${m.text}`,
    )
    .join("\n\n");

  const response = await llm.messages.create({
    model: AGENT.FAST_LLM,
    max_tokens: 2048,
    system: `You are an inbox manager for a content creator. Categorize and prioritize each message.

Return ONLY valid JSON:
{
  "messages": [
    {
      "originalText": "First 100 chars of the message",
      "category": "brand_deal|collaboration|fan_mail|spam|urgent|general",
      "priority": "high|medium|low",
      "suggestedAction": "What the creator should do",
      "brandMentioned": "Optional brand name",
      "requiresResponse": true
    }
  ],
  "summary": "Brief overview of inbox state",
  "actionRequired": 0
}

Priority rules:
- high: brand deal inquiries, time-sensitive opportunities, payment issues
- medium: collaborations, meaningful fan interactions, business queries
- low: general fan mail, spam, automated messages`,
    messages: [
      {
        role: "user",
        content: `Triage these ${messages.length} messages:\n\n${messageList}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";

  try {
    const parsed = JSON.parse(text) as TriageResult;
    log.info(
      {
        creatorId,
        triaged: parsed.messages.length,
        actionRequired: parsed.actionRequired,
      },
      "Inbox triaged",
    );
    return parsed;
  } catch (error) {
    log.error({ creatorId, error, text }, "Failed to parse triage result");
    return {
      messages: [],
      summary: "Unable to triage messages at this time.",
      actionRequired: 0,
    };
  }
}
