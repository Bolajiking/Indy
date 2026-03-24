import { describe, it, expect, vi, beforeEach } from "vitest";

// Shared mock state — tests can mutate these
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockListTools = vi.fn().mockResolvedValue({
  tools: [
    {
      name: "charge_card",
      description: "Charge a payment card",
      inputSchema: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount in cents" },
          currency: { type: "string", description: "Currency code" },
        },
        required: ["amount"],
      },
    },
    {
      name: "list_customers",
      description: "List all customers",
      inputSchema: { type: "object", properties: {} },
    },
  ],
});
const mockCallTool = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: '{"id":"ch_123","status":"succeeded"}' }],
  isError: false,
});

// Mock the MCP SDK before importing our module
vi.mock("@modelcontextprotocol/sdk/client/index.js", () => {
  class MockClient {
    connect = mockConnect;
    close = mockClose;
    listTools = mockListTools;
    callTool = mockCallTool;
    constructor(_info: unknown, _opts: unknown) {}
  }
  return { Client: MockClient };
});

vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => {
  class MockStdioTransport {
    constructor(_opts: unknown) {}
  }
  return { StdioClientTransport: MockStdioTransport };
});

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => {
  class MockSSETransport {
    constructor(_url: unknown) {}
  }
  return { SSEClientTransport: MockSSETransport };
});

// Mock registry to capture registrations
const registered: string[] = [];
vi.mock("../../../src/agent/tools/registry.js", () => ({
  registerTool: vi.fn((tool: any) => registered.push(tool.name)),
}));

import { MCPToolAdapter, loadMCPServers } from "../../../src/agent/tools/mcp-adapter.js";
import { registerTool } from "../../../src/agent/tools/registry.js";

describe("MCPToolAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registered.length = 0;
    delete process.env.MCP_SERVERS;
  });

  it("connects to a stdio MCP server and registers its tools", async () => {
    const adapter = await MCPToolAdapter.connect({
      name: "stripe",
      transport: { type: "stdio", command: "npx", args: ["-y", "@stripe/mcp"] },
    });

    await adapter.registerAll();

    expect(registerTool).toHaveBeenCalledTimes(2);
    expect(registered).toContain("mcp_stripe_charge_card");
    expect(registered).toContain("mcp_stripe_list_customers");
  });

  it("wraps MCP tool with correct metadata", async () => {
    let capturedTool: any;
    vi.mocked(registerTool).mockImplementation((tool) => {
      if (tool.name === "mcp_stripe_charge_card") capturedTool = tool;
    });

    const adapter = await MCPToolAdapter.connect({
      name: "stripe",
      transport: { type: "stdio", command: "npx" },
      autonomyLevel: "hybrid",
      maxCostPerUseCents: 100,
    });
    await adapter.registerAll();

    expect(capturedTool.autonomyLevel).toBe("hybrid");
    expect(capturedTool.costCategory).toBe("mpp");
    expect(capturedTool.maxCostPerUseCents).toBe(100);
    expect(capturedTool.description).toContain("[MCP:stripe]");
    expect(capturedTool.parameters.amount).toEqual({ type: "number", description: "Amount in cents", required: true });
    expect(capturedTool.parameters.currency).toEqual({ type: "string", description: "Currency code", required: false });
  });

  it("executes an MCP tool and returns the result", async () => {
    let capturedTool: any;
    vi.mocked(registerTool).mockImplementation((tool) => {
      if (tool.name === "mcp_stripe_charge_card") capturedTool = tool;
    });

    const adapter = await MCPToolAdapter.connect({
      name: "stripe",
      transport: { type: "stdio", command: "npx" },
    });
    await adapter.registerAll();

    const result = await capturedTool.execute(
      { amount: 5000, currency: "usd" },
      { creatorId: "creator-1", mppFetch: vi.fn() }
    );

    expect(result.success).toBe(true);
    expect(result.data).toContain("ch_123");
  });

  it("loadMCPServers returns empty array when MCP_SERVERS not set", async () => {
    const adapters = await loadMCPServers();
    expect(adapters).toEqual([]);
  });

  it("loadMCPServers loads servers from MCP_SERVERS env var", async () => {
    process.env.MCP_SERVERS = JSON.stringify([
      { name: "stripe", transport: { type: "stdio", command: "npx", args: ["-y", "@stripe/mcp"] } },
    ]);

    const adapters = await loadMCPServers();
    expect(adapters).toHaveLength(1);
    expect(registerTool).toHaveBeenCalledTimes(2);
  });

  it("loadMCPServers handles invalid JSON gracefully", async () => {
    process.env.MCP_SERVERS = "not valid json";
    const adapters = await loadMCPServers();
    expect(adapters).toEqual([]);
  });

  it("loadMCPServers continues if one server fails to connect", async () => {
    // Temporarily make connect throw
    mockConnect.mockRejectedValueOnce(new Error("Connection refused"));

    process.env.MCP_SERVERS = JSON.stringify([
      { name: "broken", transport: { type: "stdio", command: "nonexistent" } },
    ]);

    // Should not throw
    const adapters = await loadMCPServers();
    expect(adapters).toHaveLength(0);
  });
});
