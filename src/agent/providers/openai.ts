/**
 * OpenAI-compatible provider.
 *
 * Translates Anthropic-shaped Messages requests (the internal contract used
 * everywhere in this codebase) to/from the OpenAI Chat Completions format, so
 * any OpenAI-compatible endpoint — OpenAI, Azure OpenAI, OpenRouter, LiteLLM,
 * Ollama, vLLM, LM Studio, OpenClaw gateways — can back the agent.
 */

import type Anthropic from "@anthropic-ai/sdk";
import pino from "#logger";
import { ipv4Fetch } from "../../network/ipv4-fetch.js";

const log = pino({ name: "agent:openai-provider" });

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

type OpenAIMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

interface OpenAIChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
      tool_calls?: OpenAIToolCall[];
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function blocksToText(blocks: Anthropic.ContentBlockParam[]): string {
  return blocks
    .filter((b): b is Anthropic.TextBlockParam => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function toolResultContent(block: Anthropic.ToolResultBlockParam): string {
  const { content } = block;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c): c is Anthropic.TextBlockParam => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }
  return "";
}

function translateMessages(
  system: string | undefined,
  messages: Anthropic.MessageParam[],
): OpenAIMessage[] {
  const out: OpenAIMessage[] = [];
  if (system) out.push({ role: "system", content: system });

  for (const message of messages) {
    const { role, content } = message;

    if (typeof content === "string") {
      out.push(
        role === "assistant"
          ? { role: "assistant", content }
          : { role: "user", content },
      );
      continue;
    }

    if (role === "assistant") {
      const toolCalls = content
        .filter((b): b is Anthropic.ToolUseBlockParam => b.type === "tool_use")
        .map<OpenAIToolCall>((b) => ({
          id: b.id,
          type: "function",
          function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
        }));
      const text = blocksToText(content);
      out.push({
        role: "assistant",
        content: text || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
      continue;
    }

    // role === "user": tool results become individual tool messages; any text
    // becomes a trailing user message.
    for (const block of content) {
      if (block.type === "tool_result") {
        out.push({
          role: "tool",
          tool_call_id: block.tool_use_id,
          content: toolResultContent(block),
        });
      }
    }
    const text = blocksToText(content);
    if (text) out.push({ role: "user", content: text });
  }

  return out;
}

function translateTools(tools: Anthropic.Tool[] | undefined) {
  if (!tools || tools.length === 0) return undefined;
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

function mapStopReason(
  finishReason: string | undefined,
  hasToolCalls: boolean,
): Anthropic.Message["stop_reason"] {
  if (hasToolCalls || finishReason === "tool_calls") return "tool_use";
  if (finishReason === "length") return "max_tokens";
  return "end_turn";
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    log.warn(
      { error, status: response.status },
      "Failed to read OpenAI-compatible error response body",
    );
    return "";
  }
}

export async function createOpenAIMessage(
  params: Anthropic.MessageCreateParamsNonStreaming,
  opts: { baseURL: string; apiKey: string; model: string },
): Promise<Anthropic.Message> {
  const system = typeof params.system === "string" ? params.system : undefined;
  const tools = translateTools(params.tools as Anthropic.Tool[] | undefined);

  const body = {
    model: opts.model,
    max_tokens: params.max_tokens,
    messages: translateMessages(system, params.messages),
    ...(tools ? { tools, tool_choice: "auto" as const } : {}),
  };

  const response = await ipv4Fetch(
    `${opts.baseURL.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    const error = new Error(
      `OpenAI-compatible request failed (${response.status}): ${detail.slice(0, 500)}`,
    );
    // Surface the HTTP status so the agent loop's retry logic can react.
    (error as Error & { status: number }).status = response.status;
    // Surface the server's suggested wait (header, else the "try again in Xs"
    // hint in the body) so the loop can honor the real rate-limit reset rather
    // than guessing with a short exponential backoff.
    const headerRetry = Number(response.headers?.get?.("retry-after"));
    const bodyRetry = /try again in ([\d.]+)\s*s/i.exec(detail)?.[1];
    const retryAfterMs = Number.isFinite(headerRetry)
      ? headerRetry * 1000
      : bodyRetry
        ? Math.ceil(Number(bodyRetry) * 1000)
        : undefined;
    if (retryAfterMs !== undefined) {
      (error as Error & { retryAfterMs: number }).retryAfterMs = retryAfterMs;
    }
    throw error;
  }

  const json = (await response.json()) as OpenAIChatResponse;
  const choice = json.choices?.[0];
  const message = choice?.message;

  // Content blocks consumed by the agent loop (it reads type/text/id/name/input).
  const blocks: Array<Record<string, unknown>> = [];
  if (message?.content) {
    blocks.push({ type: "text", text: message.content, citations: null });
  }
  for (const call of message?.tool_calls ?? []) {
    let input: unknown = {};
    try {
      input = call.function.arguments
        ? JSON.parse(call.function.arguments)
        : {};
    } catch (error) {
      log.warn(
        { error, callId: call.id, tool: call.function.name },
        "OpenAI-compatible tool call arguments were not valid JSON; using empty input",
      );
      input = {};
    }
    blocks.push({
      type: "tool_use",
      id: call.id,
      name: call.function.name,
      input,
    });
  }

  const hasToolCalls = (message?.tool_calls?.length ?? 0) > 0;

  // Single interop cast: we construct the Anthropic Message nominal type from
  // OpenAI wire data. The loop only reads content/stop_reason, so a minimal
  // usage object is sufficient.
  return {
    id: json.id ?? `oai-${Date.now()}`,
    type: "message",
    role: "assistant",
    model: json.model ?? opts.model,
    content: blocks,
    stop_reason: mapStopReason(choice?.finish_reason, hasToolCalls),
    stop_sequence: null,
    usage: {
      input_tokens: json.usage?.prompt_tokens ?? 0,
      output_tokens: json.usage?.completion_tokens ?? 0,
    },
  } as unknown as Anthropic.Message;
}
