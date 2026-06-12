import {
  readNumberParam,
  readStringParam,
  registerTool,
  type AgentTool,
} from "./registry.js";

const webSearchTool: AgentTool = {
  name: "web_search",
  description:
    "Search the web for brand deal opportunities, creator marketplace listings, industry news, or competitive intelligence.",
  autonomyLevel: "autonomous",
  costCategory: "mpp",
  maxCostPerUseCents: 25,
  parameters: {
    query: {
      type: "string",
      description: "Search query",
      required: true,
    },
    num_results: {
      type: "number",
      description: "Number of results to return",
      required: false,
    },
  },
  async execute(params, context) {
    try {
      const query = readStringParam(params, "query");
      if (!query) {
        return {
          success: false,
          data: null,
          error: "query is required",
        };
      }
      const numResults = readNumberParam(params, "num_results");

      const url = new URL("https://stableenrich.dev/api/exa/search");
      url.searchParams.set("query", query);
      url.searchParams.set("num_results", String(numResults ?? 5));

      const response = await context.mppFetch(url.toString());
      if (!response.ok) {
        return {
          success: false,
          data: null,
          error: `Search failed: ${response.status}`,
        };
      }

      const data: unknown = await response.json();
      return {
        success: true,
        data,
        costCents: 10,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : "Unknown web search error",
      };
    }
  },
};

registerTool(webSearchTool);
