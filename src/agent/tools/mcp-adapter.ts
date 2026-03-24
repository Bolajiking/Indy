/**
 * MCP Tool Adapter
 *
 * Wraps any MCP (Model Context Protocol) server as a set of AgentTool entries
 * that can be registered in the standard tool registry.
 *
 * Usage:
 *   const adapter = await MCPToolAdapter.connect({ transport: "stdio", command: "npx", args: ["-y", "@stripe/mcp"] });
 *   adapter.registerAll();  // registers each MCP tool into the global registry
 *
 * The adapter translates between:
 *   - MCP's ListTools / CallTool protocol
 *   - Our internal AgentTool interface
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import pino from "pino";
import { registerTool, type AgentTool, type ToolContext, type ToolResult } from "./registry.js";

const log = pino({ name: "agent:mcp-adapter" });

export type MCPTransportConfig =
  | { type: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
  | { type: "sse"; url: string; headers?: Record<string, string> };

export interface MCPServerConfig {
  name: string;
  transport: MCPTransportConfig;
  /**
   * Override autonomy level for all tools from this server.
   * Defaults to "autonomous". Set to "hybrid" to require approval for all calls.
   */
  autonomyLevel?: "autonomous" | "hybrid";
  /** Override max cost in cents for all tools from this server (default: 0 = free). */
  maxCostPerUseCents?: number;
}

export class MCPToolAdapter {
  private client: Client;
  private serverName: string;
  private config: MCPServerConfig;

  private constructor(client: Client, config: MCPServerConfig) {
    this.client = client;
    this.serverName = config.name;
    this.config = config;
  }

  static async connect(config: MCPServerConfig): Promise<MCPToolAdapter> {
    const client = new Client(
      { name: "indyfren-agent", version: "1.0.0" },
      { capabilities: {} }
    );

    let transport;
    if (config.transport.type === "stdio") {
      transport = new StdioClientTransport({
        command: config.transport.command,
        args: config.transport.args,
        env: config.transport.env,
      });
    } else {
      transport = new SSEClientTransport(new URL(config.transport.url));
    }

    await client.connect(transport);
    log.info({ server: config.name }, "Connected to MCP server");

    return new MCPToolAdapter(client, config);
  }

  async registerAll(): Promise<void> {
    const { tools } = await this.client.listTools();

    for (const mcpTool of tools) {
      const agentTool = this.wrapMCPTool(mcpTool);
      registerTool(agentTool);
      log.info({ server: this.serverName, tool: mcpTool.name }, "Registered MCP tool");
    }
  }

  private wrapMCPTool(mcpTool: {
    name: string;
    description?: string;
    inputSchema: { type: string; properties?: Record<string, unknown>; required?: string[] };
  }): AgentTool {
    const serverName = this.serverName;
    const client = this.client;
    const autonomyLevel = this.config.autonomyLevel ?? "autonomous";
    const maxCostPerUseCents = this.config.maxCostPerUseCents ?? 0;

    // Translate MCP JSON Schema properties to our flat parameter format
    const properties = (mcpTool.inputSchema.properties ?? {}) as Record<
      string,
      { type?: string; description?: string }
    >;
    const required = new Set(mcpTool.inputSchema.required ?? []);

    const parameters: AgentTool["parameters"] = {};
    for (const [key, schema] of Object.entries(properties)) {
      parameters[key] = {
        type: schema.type ?? "string",
        description: schema.description ?? key,
        required: required.has(key),
      };
    }

    return {
      name: `mcp_${serverName}_${mcpTool.name}`,
      description: `[MCP:${serverName}] ${mcpTool.description ?? mcpTool.name}`,
      autonomyLevel,
      costCategory: maxCostPerUseCents > 0 ? "mpp" : "free",
      maxCostPerUseCents,
      parameters,
      execute: async (
        params: Record<string, unknown>,
        _context: ToolContext
      ): Promise<ToolResult> => {
        try {
          const result = await client.callTool({ name: mcpTool.name, arguments: params });
          const content = result.content as Array<{ type: string; text?: string }>;
          const textContent = content
            .filter((c) => c.type === "text")
            .map((c) => c.text ?? "")
            .join("\n");

          return {
            success: !result.isError,
            data: textContent || result.content,
            costCents: maxCostPerUseCents,
          };
        } catch (err: any) {
          log.error({ server: serverName, tool: mcpTool.name, error: err.message }, "MCP tool call failed");
          return { success: false, data: null, error: err.message };
        }
      },
    };
  }

  async disconnect(): Promise<void> {
    await this.client.close();
    log.info({ server: this.serverName }, "Disconnected from MCP server");
  }
}

/**
 * Load and register all MCP servers defined in environment config.
 * Called once at server startup.
 *
 * MCP_SERVERS env var is a JSON array of MCPServerConfig objects, e.g.:
 * [{"name":"stripe","transport":{"type":"stdio","command":"npx","args":["-y","@stripe/mcp"]}}]
 */
export async function loadMCPServers(): Promise<MCPToolAdapter[]> {
  const raw = process.env.MCP_SERVERS;
  if (!raw) {
    log.debug("No MCP_SERVERS configured — skipping MCP tool loading");
    return [];
  }

  let configs: MCPServerConfig[];
  try {
    configs = JSON.parse(raw);
  } catch (err) {
    log.error({ error: err }, "Invalid MCP_SERVERS JSON — skipping");
    return [];
  }

  const adapters: MCPToolAdapter[] = [];
  for (const config of configs) {
    try {
      const adapter = await MCPToolAdapter.connect(config);
      await adapter.registerAll();
      adapters.push(adapter);
    } catch (err: any) {
      log.error({ server: config.name, error: err.message }, "Failed to connect to MCP server");
    }
  }

  log.info({ count: adapters.length }, "MCP servers loaded");
  return adapters;
}
