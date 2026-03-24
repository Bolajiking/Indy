import type { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import type { findService as FindServiceFn } from "./x402-registry.js";

export type AutonomyLevel = "autonomous" | "hybrid";
export type CostCategory = "free" | "mpp" | "platform-api";

export interface AgentTool {
  name: string;
  description: string;
  autonomyLevel: AutonomyLevel;
  costCategory: CostCategory;
  maxCostPerUseCents: number;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  creatorId: string;
  mppFetch: (url: string, options?: RequestInit) => Promise<Response>;
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

export function getToolsForLLM(): Array<{
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required: string[] };
}> {
  return getAllTools().map((tool) => ({
    name: tool.name,
    description: `${tool.description} [${tool.autonomyLevel}] [cost: ${tool.costCategory}]`,
    input_schema: {
      type: "object" as const,
      properties: Object.fromEntries(
        Object.entries(tool.parameters).map(([key, val]) => [
          key,
          { type: val.type, description: val.description },
        ])
      ),
      required: Object.entries(tool.parameters)
        .filter(([, v]) => v.required)
        .map(([k]) => k),
    },
  }));
}
