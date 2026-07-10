/**
 * Shared LLM tool-use loop.
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
import { isJsonObject, type JsonObject } from "../db/json.js";
import {
  describeToolSchema,
  getTool,
  getToolsForLLM,
  missingRequiredParams,
  type AgentTool,
  type ToolContext,
} from "./tools/registry.js";
import type { PendingAgentAction } from "./types.js";
import {
  serializeUntrustedExternalData,
  wrapUntrustedExternalData,
} from "./tool-result.js";
import { errMsg } from "../lib/errors.js";
import llm from "./llm.js";
import { TRUST_BOUNDARY_DIRECTIVE } from "./prompts.js";
import {
  formatActionPreview,
  inferActionTarget,
  sanitizeMaterialArguments,
  validateActionPreview,
} from "./action-preview.js";

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
  /** Skill currently invoking this loop, when called through AgentOS */
  activeSkill?: string;
  /** Extra tool schemas (e.g. connected-app tools via Composio) for this run. */
  dynamicTools?: Anthropic.Tool[];
  /**
   * Executor for dynamicTools, keyed by tool name. Returns null when the name
   * is not a dynamic tool (so the loop reports it as unknown).
   */
  executeDynamicTool?: (
    name: string,
    input: JsonObject,
  ) => Promise<{ content: string; isError: boolean } | null>;
  /** Returns true if a dynamic tool call is a write action that needs approval. */
  dynamicToolNeedsApproval?: (name: string, input: JsonObject) => boolean;
  /** Appended to systemPrompt for this run only (e.g. connected-apps summary). */
  systemPromptSuffix?: string;
}

export interface AgentLoopResult {
  text: string;
  requiresApproval: boolean;
  skill?: string;
  /** Names of every tool that was successfully called during the loop */
  toolCallNames?: string[];
  /** Services the agent asked the dashboard to surface connect prompts for */
  connections?: string[];
  pendingAction?: PendingAgentAction & {
    /** The Anthropic tool_use block ID — needed to re-enter the agent loop after approval */
    toolUseId: string;
    /** Snapshot of messages up to and including the assistant tool_use block */
    messageHistory: Anthropic.MessageParam[];
    systemPrompt: string;
  };
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const { status, statusCode } = error as {
    status?: unknown;
    statusCode?: unknown;
  };

  return typeof status === "number"
    ? status
    : typeof statusCode === "number"
      ? statusCode
      : undefined;
}

function asToolInput(input: unknown): JsonObject | null {
  return isJsonObject(input) ? input : null;
}

type RegistryCallResolution =
  | { kind: "call"; tool: AgentTool; input: JsonObject }
  | { kind: "error"; message: string }
  | { kind: "none" };

/**
 * Resolve a tool_use block to a registry tool + arguments. Handles both direct
 * calls and the `use_tool` wrapper for deferred tools (whose schemas are not
 * resident in the prompt): the wrapper is unwrapped here so approval gating,
 * cost tracking, and execution all see the real tool. Bad use_tool calls get
 * the target's full schema back so the model can self-correct in one step.
 */
function resolveRegistryCall(
  name: string,
  input: JsonObject | null,
): RegistryCallResolution {
  const direct = getTool(name);
  if (direct) {
    if (!input) {
      return {
        kind: "error",
        message: `Error: Tool "${name}" input must be an object`,
      };
    }
    return { kind: "call", tool: direct, input };
  }

  if (name !== "use_tool") return { kind: "none" };

  const targetName = typeof input?.tool === "string" ? input.tool : null;
  const target = targetName ? getTool(targetName) : undefined;
  if (!target) {
    return {
      kind: "error",
      message: `Error: Unknown tool "${targetName ?? "(missing)"}" — \`tool\` must be one of the names listed on use_tool.`,
    };
  }
  const args = isJsonObject(input?.arguments) ? input.arguments : {};
  const missing = missingRequiredParams(target, args);
  if (missing.length > 0) {
    return {
      kind: "error",
      message: `Error: Missing required parameter(s) ${missing.join(", ")} for "${target.name}". Full schema: ${describeToolSchema(target)}`,
    };
  }
  return { kind: "call", tool: target, input: args };
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { retryAfterMs } = error as { retryAfterMs?: unknown };
  return typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs)
    ? retryAfterMs
    : undefined;
}

async function callLlm(
  params: Anthropic.MessageCreateParamsNonStreaming,
  retries = 5,
): Promise<Anthropic.Message> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await llm.messages.create(params);
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      if ((status === 429 || status === 529) && attempt < retries) {
        // Honor the server's suggested wait when present (TPM resets are often
        // 10–60s out — a short exponential backoff gives up far too early and
        // surfaces a spurious "I lost my train of thought"). Add small jitter
        // and cap so we never hang the request indefinitely.
        const suggested = getRetryAfterMs(err);
        const backoff = Math.min(1000 * 2 ** (attempt - 1), 8000);
        const delay = Math.min(
          (suggested ?? backoff) + Math.floor(Math.random() * 500),
          20_000,
        );
        log.warn(
          { attempt, delay, status, suggested },
          "LLM rate-limited, retrying",
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Exhausted retries");
}

export async function runAgentLoop(
  config: AgentLoopConfig,
): Promise<AgentLoopResult> {
  const {
    systemPrompt,
    toolContext,
    maxSteps = AGENT.MAX_STEPS_PER_TASK,
    onToolUsed,
  } = config;

  // Effective prompt = base + any per-run suffix (e.g. the creator's connected
  // apps). The base prompt is what we snapshot for approval re-entry, so the
  // suffix is recomputed fresh on re-entry rather than double-stored.
  const effectiveSystemPrompt =
    systemPrompt +
    (config.systemPromptSuffix ?? "") +
    `\n\n${TRUST_BOUNDARY_DIRECTIVE}`;

  // Build a minimal context for free tools when no wallet is configured.
  // Free tools (create_deal, update_deal_stage, web search, etc.) only need creatorId —
  // they never call mppFetch. This lets deal persistence work even before wallet setup.
  const freeToolContext: ToolContext | null =
    toolContext ??
    (config.creatorId
      ? {
          creatorId: config.creatorId,
          activeSkill: config.activeSkill,
          mppFetch: async () => {
            throw new Error("No wallet configured for paid tool");
          },
        }
      : null);

  const tools = [...getToolsForLLM(), ...(config.dynamicTools ?? [])];
  const messages = [...config.messages];

  let response: Anthropic.Message;
  try {
    response = await callLlm({
      model: AGENT.DEFAULT_LLM,
      max_tokens: 4096,
      system: effectiveSystemPrompt,
      tools: tools.length > 0 ? tools : undefined,
      messages,
    });
  } catch (err: unknown) {
    log.error({ error: errMsg(err) }, "Initial LLM call failed");
    return {
      text: "Sorry, I'm having trouble thinking right now. Please try again.",
      requiresApproval: false,
    };
  }

  let steps = 0;
  const toolCallNames: string[] = [];
  const connections = new Set<string>();

  while (response.stop_reason === "tool_use" && steps < maxSteps) {
    steps++;
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const toolInput = asToolInput(toolUse.input);
      const resolution = resolveRegistryCall(toolUse.name, toolInput);

      if (resolution.kind === "error") {
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: resolution.message,
          is_error: true,
        });
        continue;
      }

      if (resolution.kind === "none") {
        // Not a registered tool — try dynamic (connected-app) tools.
        if (config.executeDynamicTool) {
          // Write actions on a connected account require explicit approval,
          // routed through the same approve/skip flow as hybrid tools.
          if (
            config.dynamicToolNeedsApproval?.(toolUse.name, toolInput ?? {})
          ) {
            // execute_app_tool wraps the real action as {slug, arguments} —
            // store the unwrapped slug/args so approval display shows the real
            // action and approval execution can run it by slug directly.
            const isAppToolWrapper =
              toolUse.name === "execute_app_tool" &&
              typeof toolInput?.slug === "string";
            const pendingType = isAppToolWrapper
              ? (toolInput.slug as string)
              : toolUse.name;
            const pendingInput = isAppToolWrapper
              ? isJsonObject(toolInput.arguments)
                ? toolInput.arguments
                : {}
              : (toolInput ?? {});
            const target = inferActionTarget(pendingInput);
            const service = isAppToolWrapper
              ? pendingType.split("_")[0]?.toLowerCase()
              : toolUse.name.replace(/^mcp_/, "mcp:").split("_")[0];
            const preview = validateActionPreview({
              service,
              operation: pendingType,
              target: target ?? undefined,
              materialArguments: sanitizeMaterialArguments(pendingInput),
              maxCostCents: 0,
            });
            if (!preview) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolUse.id,
                content:
                  "Error: Approval preview unavailable because the write action is missing a recipient or target. Ask the creator for the exact destination before retrying.",
                is_error: true,
              });
              continue;
            }
            log.info(
              { tool: pendingType },
              "Connected-app write action — requesting approval",
            );
            const approvalId = randomUUID();
            const approvalSummary = formatActionPreview(preview);
            const historyWithToolUse = [
              ...messages,
              { role: "assistant" as const, content: response.content },
            ];
            return {
              text: approvalSummary,
              requiresApproval: true,
              pendingAction: {
                id: approvalId,
                type: pendingType,
                description: approvalSummary,
                input: pendingInput,
                toolUseId: toolUse.id,
                messageHistory: historyWithToolUse,
                systemPrompt,
              },
            };
          }

          const dynamic = await config.executeDynamicTool(
            toolUse.name,
            toolInput ?? {},
          );
          if (dynamic) {
            toolCallNames.push(toolUse.name);
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: wrapUntrustedExternalData(
                dynamic.content,
                toolUse.name === "execute_app_tool"
                  ? `composio:${String(toolInput?.slug ?? "unknown")}`
                  : `composio:${toolUse.name}`,
              ),
              is_error: dynamic.isError,
            });
            continue;
          }
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: `Error: Unknown tool "${toolUse.name}"`,
          is_error: true,
        });
        continue;
      }

      // Registry call — `tool`/`input` are the real tool and arguments, with any
      // use_tool wrapper already unwrapped by resolveRegistryCall.
      const { tool, input } = resolution;

      if (tool.autonomyLevel === "hybrid") {
        const preview = validateActionPreview(
          tool.buildApprovalPreview?.(input) ?? {},
        );
        if (!preview) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content:
              "Error: Approval preview unavailable because required service, operation, recipient/target, material arguments, or maximum cost is missing. Ask the creator for the missing destination before retrying.",
            is_error: true,
          });
          continue;
        }
        log.info({ tool: tool.name }, "Hybrid tool — requesting approval");
        const approvalId = randomUUID();
        const approvalSummary = formatActionPreview(preview);
        // Snapshot messages up to and including this assistant response so we can
        // re-enter the agent loop after approval with full conversation context.
        const historyWithToolUse = [
          ...messages,
          { role: "assistant" as const, content: response.content },
        ];
        return {
          text: approvalSummary,
          requiresApproval: true,
          pendingAction: {
            id: approvalId,
            type: tool.name,
            description: approvalSummary,
            input,
            toolUseId: toolUse.id,
            messageHistory: historyWithToolUse,
            systemPrompt,
          },
        };
      }

      // For paid tools, require a full wallet context.
      // For free tools, use the minimal freeToolContext (only needs creatorId).
      const execContext =
        tool.costCategory === "free" ? freeToolContext : toolContext;
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
        const result = await tool.execute(input, execContext);
        onToolUsed?.(tool.name, tool.maxCostPerUseCents);
        toolCallNames.push(tool.name);
        // Capture connection prompts so the dashboard can render inline cards.
        if (tool.name === "request_connections" && result.success) {
          const surfaced = (result.data as { surfaced?: unknown })?.surfaced;
          if (Array.isArray(surfaced)) {
            for (const s of surfaced)
              if (typeof s === "string") connections.add(s);
          }
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          // Clamp before the result re-enters the LLM — a registered tool
          // (web search, browser, enrichment, paid API) can return a payload
          // far larger than the model accepts in one follow-up call.
          content: serializeUntrustedExternalData(
            result.data,
            `tool:${tool.name}`,
          ),
        });
      } catch (err: unknown) {
        // Provider errors can echo signed URLs, tokens, or request bodies.
        // Keep those in the source-labelled model envelope, never in logs.
        log.error({ tool: tool.name }, "Tool execution failed");
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: wrapUntrustedExternalData(
            `Error: ${errMsg(err)}`,
            `tool:${tool.name}`,
          ),
          is_error: true,
        });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });

    try {
      response = await callLlm({
        model: AGENT.DEFAULT_LLM,
        max_tokens: 4096,
        system: effectiveSystemPrompt,
        tools: tools.length > 0 ? tools : undefined,
        messages,
      });
    } catch (err: unknown) {
      log.error({ error: errMsg(err) }, "LLM call failed in loop");
      return {
        text: "Sorry, I lost my train of thought. Please try again.",
        requiresApproval: false,
      };
    }
  }

  const textBlocks = response.content.filter(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );

  return {
    text:
      textBlocks.map((b) => b.text).join("\n") ||
      "I couldn't generate a response. Please try again.",
    requiresApproval: false,
    toolCallNames,
    connections: connections.size > 0 ? [...connections] : undefined,
  };
}
