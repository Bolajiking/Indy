import type { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import type Anthropic from "@anthropic-ai/sdk";
import type { JsonObject } from "../../db/json.js";
import type { findService as FindServiceFn } from "./x402-registry.js";

export type AutonomyLevel = "autonomous" | "hybrid";
export type CostCategory = "free" | "mpp" | "platform-api";

export interface AgentTool {
  name: string;
  description: string;
  autonomyLevel: AutonomyLevel;
  costCategory: CostCategory;
  maxCostPerUseCents: number;
  /**
   * Deferred tools keep their full schema out of the resident prompt: they are
   * listed as one-liners on the `use_tool` meta-tool and invoked through it.
   * Reserve for occasional/long-tail capabilities — bread-and-butter tools
   * stay resident.
   */
  deferred?: boolean;
  parameters: Record<
    string,
    { type: string; description: string; required?: boolean }
  >;
  execute: (params: JsonObject, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  creatorId: string;
  mppFetch: (url: string, options?: RequestInit) => Promise<Response>;
  /** Skill currently invoking tools, when called through AgentOS */
  activeSkill?: string;
  /** MCP client for calling tools on connected MCP servers (optional) */
  mcpClient?: MCPClient;
  /** Discover x402 services by capability category (optional) */
  findService?: typeof FindServiceFn;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  costCents?: number;
  error?: string;
}

/** Read a string tool parameter, or null when absent or not a string. */
export function readStringParam(params: JsonObject, key: string): string | null {
  const value = params[key];
  return typeof value === "string" ? value : null;
}

/** Read a finite number tool parameter, or null when absent or invalid. */
export function readNumberParam(params: JsonObject, key: string): number | null {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const tools = new Map<string, AgentTool>();

export function registerTool(tool: AgentTool): void {
  tools.set(tool.name, tool);
}

export function getTool(name: string): AgentTool | undefined {
  return tools.get(name);
}

export function getAllTools(): AgentTool[] {
  return Array.from(tools.values());
}

function toLLMSchema(tool: AgentTool): Anthropic.Tool {
  return {
    name: tool.name,
    description: `${tool.description} [${tool.autonomyLevel}] [cost: ${tool.costCategory}]`,
    input_schema: {
      type: "object" as const,
      properties: Object.fromEntries(
        Object.entries(tool.parameters).map(([key, val]) => [
          key,
          { type: val.type, description: val.description },
        ]),
      ),
      required: Object.entries(tool.parameters)
        .filter(([, v]) => v.required)
        .map(([k]) => k),
    },
  };
}

/** First sentence of a tool description — the one-liner for the use_tool catalog. */
function oneLiner(description: string): string {
  const firstSentence = description.split(/(?<=\.)\s/)[0] ?? description;
  return firstSentence.slice(0, 140);
}

/**
 * Resident tool schemas: every non-deferred tool, plus one `use_tool` meta-tool
 * that catalogs the deferred ones as one-liners. Keeps the prompt's resident
 * cost on the bread-and-butter tools while the long tail stays one call away.
 */
export function getToolsForLLM(): Anthropic.Tool[] {
  const all = getAllTools();
  const resident = all.filter((t) => !t.deferred);
  const deferredTools = all.filter((t) => t.deferred);

  const schemas = resident.map(toLLMSchema);
  if (deferredTools.length > 0) {
    const catalog = deferredTools
      .map((t) => `- ${t.name}: ${oneLiner(t.description)}`)
      .join("\n");
    schemas.push({
      name: "use_tool",
      description: `Run one of these additional tools (their full parameter schemas load on first use — if a call is missing required parameters, the error returns the schema so you can retry):\n${catalog}`,
      input_schema: {
        type: "object",
        properties: {
          tool: {
            type: "string",
            description: "Tool name from the list above.",
            enum: deferredTools.map((t) => t.name),
          },
          arguments: {
            type: "object",
            description: "Arguments for that tool.",
          },
        },
        required: ["tool", "arguments"],
      },
    });
  }
  return schemas;
}

/** Full schema of one tool, used as corrective feedback for bad use_tool calls. */
export function describeToolSchema(tool: AgentTool): string {
  return JSON.stringify(toLLMSchema(tool));
}

/** Names of required parameters missing from a use_tool invocation. */
export function missingRequiredParams(
  tool: AgentTool,
  input: JsonObject,
): string[] {
  return Object.entries(tool.parameters)
    .filter(([key, spec]) => spec.required && input[key] === undefined)
    .map(([key]) => key);
}
