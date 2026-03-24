/**
 * Shared agentic tool-use loop.
 *
 * Both the general orchestrator and skill-runner call this. Config drives:
 * - credit checks (orchestrator only)
 * - step limits
 * - system prompt / memory injection
 * - hybrid-tool approval handling
 */

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import pino from "pino";
import { AGENT } from "../config/constants.js";
import { getTool, getToolsForLLM, type ToolContext } from "./tools/registry.js";
import anthropic from "./anthropic.js";

const log = pino({ name: "agent:loop" });

export interface AgentLoopConfig {
  systemPrompt: string;
  messages: Anthropic.MessageParam[];
  toolContext: ToolContext | null;
  /** Creator ID — required so free tools (create_deal, etc.) can run even without a wallet */
  creatorId?: string;
  maxSteps?: number;
  /** Called after every successful autonomous tool use so callers can track cost. */
  onToolUsed?: (toolName: string, costCents: number) => void;
}

export interface AgentLoopResult {
  text: string;
  requiresApproval: boolean;
  skill?: string;
  pendingAction?: {
    id: string;
    type: string;
    description: string;
    input: Record<string, unknown>;
    /** The Anthropic tool_use block ID — needed to re-enter the agent loop after approval */
    toolUseId: string;
    /** Snapshot of messages up to and including the assistant tool_use block */
    messageHistory: any[];
    systemPrompt: string;
  };
}

async function callClaude(
  params: Anthropic.MessageCreateParamsNonStreaming,
  retries = 3
): Promise<Anthropic.Message> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      if ((status === 429 || status === 529) && attempt < retries) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        log.warn({ attempt, delay, status }, "Claude rate-limited, retrying");
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Exhausted retries");
}

export async function runAgentLoop(config: AgentLoopConfig): Promise<AgentLoopResult> {
  const { systemPrompt, toolContext, maxSteps = AGENT.MAX_STEPS_PER_TASK, onToolUsed } = config;

  // Build a minimal context for free tools when no wallet is configured.
  // Free tools (create_deal, update_deal_stage, web search, etc.) only need creatorId —
  // they never call mppFetch. This lets deal persistence work even before wallet setup.
  const freeToolContext: ToolContext | null = toolContext ?? (
    config.creatorId
      ? {
          creatorId: config.creatorId,
          mppFetch: async () => {
            throw new Error("No wallet configured for paid tool");
          },
        }
      : null
  );

  const tools = getToolsForLLM();
  const messages = [...config.messages];

  let response: Anthropic.Message;
  try {
    response = await callClaude({
      model: AGENT.DEFAULT_LLM,
      max_tokens: 4096,
      system: systemPrompt,
      tools: tools.length > 0 ? (tools as any) : undefined,
      messages,
    });
  } catch (err: any) {
    log.error({ error: err.message }, "Initial LLM call failed");
    return { text: "Sorry, I'm having trouble thinking right now. Please try again.", requiresApproval: false };
  }

  let steps = 0;

  while (response.stop_reason === "tool_use" && steps < maxSteps) {
    steps++;
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const tool = getTool(toolUse.name);
      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Error: Unknown tool "${toolUse.name}"`,
          is_error: true,
        });
        continue;
      }

      if (tool.autonomyLevel === "hybrid") {
        log.info({ tool: toolUse.name }, "Hybrid tool — requesting approval");
        const approvalId = randomUUID();
        const approvalSummary = `Approval needed: ${tool.name}\n${tool.description}\nEstimated max cost: $${(tool.maxCostPerUseCents / 100).toFixed(2)}\nParameters: ${JSON.stringify(toolUse.input)}`;
        // Snapshot messages up to and including this assistant response so we can
        // re-enter the agent loop after approval with full conversation context.
        const historyWithToolUse = [
          ...messages,
          { role: "assistant", content: response.content },
        ];
        return {
          text: approvalSummary,
          requiresApproval: true,
          pendingAction: {
            id: approvalId,
            type: toolUse.name,
            description: approvalSummary,
            input: toolUse.input as Record<string, unknown>,
            toolUseId: toolUse.id,
            messageHistory: historyWithToolUse,
            systemPrompt,
          },
        };
      }

      // For paid tools, require a full wallet context.
      // For free tools, use the minimal freeToolContext (only needs creatorId).
      const execContext = tool.costCategory === "free" ? freeToolContext : toolContext;
      if (!execContext) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: "Error: No wallet configured for paid tool.",
          is_error: true,
        });
        continue;
      }

      try {
        const result = await tool.execute(toolUse.input as Record<string, unknown>, execContext);
        onToolUsed?.(toolUse.name, tool.maxCostPerUseCents);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result.data),
        });
      } catch (err: any) {
        log.error({ tool: toolUse.name, error: err.message }, "Tool execution failed");
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Error: ${err.message}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    try {
      response = await callClaude({
        model: AGENT.DEFAULT_LLM,
        max_tokens: 4096,
        system: systemPrompt,
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
