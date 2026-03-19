import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { AGENT } from "../config/constants.js";
import { getToolsForLLM, getTool, type ToolContext } from "./tools/registry.js";
import { assembleContext } from "./memory.js";
import { createMppClient } from "../wallet/mpp.js";
import pino from "pino";

const log = pino({ name: "agent:orchestrator" });

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Indyfren, an AI business manager for independent content creators. Your #1 job is helping creators make more money.

## Your Capabilities
- Find brand deal opportunities and pitch them
- Calculate fair rates based on market data
- Generate professional pitch emails
- Review contracts and flag issues
- Track deal pipelines
- Provide daily morning briefs

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
- When showing deals, include fit score and estimated value`;

export interface AgentResponse {
  text: string;
  requiresApproval: boolean;
  pendingAction?: {
    id: string;
    type: string;
    description: string;
  };
}

export async function runAgent(
  creatorId: string,
  userMessage: string,
  walletId?: string,
  walletAddress?: string
): Promise<AgentResponse> {
  log.info({ creatorId, message: userMessage.slice(0, 100) }, "Agent invoked");

  const context = await assembleContext(creatorId);
  const tools = getToolsForLLM();

  let toolContext: ToolContext | null = null;
  if (walletId && walletAddress) {
    const mppClient = await createMppClient(creatorId, walletId, walletAddress as `0x${string}`);
    toolContext = { creatorId, mppFetch: mppClient.fetch };
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `<creator_context>\n${context}\n</creator_context>\n\n${userMessage}`,
    },
  ];

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: AGENT.DEFAULT_LLM,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: tools.length > 0 ? (tools as any) : undefined,
      messages,
    });
  } catch (err: any) {
    log.error({ error: err.message }, "LLM call failed");
    return { text: "Sorry, I'm having trouble thinking right now. Please try again.", requiresApproval: false };
  }

  let steps = 0;
  while (response.stop_reason === "tool_use" && steps < AGENT.MAX_STEPS_PER_TASK) {
    steps++;
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const tool = getTool(toolUse.name);
      if (!tool) {
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: `Error: Unknown tool "${toolUse.name}"`, is_error: true });
        continue;
      }

      if (tool.autonomyLevel === "hybrid") {
        log.info({ tool: toolUse.name }, "Hybrid tool — requesting approval");
        return {
          text: "",
          requiresApproval: true,
          pendingAction: { id: toolUse.id, type: toolUse.name, description: JSON.stringify(toolUse.input) },
        };
      }

      if (!toolContext) {
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: "Error: No wallet configured.", is_error: true });
        continue;
      }

      try {
        const result = await tool.execute(toolUse.input as Record<string, unknown>, toolContext);
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result.data) });
      } catch (err: any) {
        log.error({ tool: toolUse.name, error: err.message }, "Tool execution failed");
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: `Error: ${err.message}`, is_error: true });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    try {
      response = await anthropic.messages.create({
        model: AGENT.DEFAULT_LLM,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: tools.length > 0 ? (tools as any) : undefined,
        messages,
      });
    } catch (err: any) {
      log.error({ error: err.message }, "LLM call failed in loop");
      return { text: "Sorry, I lost my train of thought. Please try again.", requiresApproval: false };
    }
  }

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );

  return {
    text: textBlocks.map((b) => b.text).join("\n") || "I couldn't generate a response. Please try again.",
    requiresApproval: false,
  };
}
