import { registerTool, type AgentTool } from "./registry.js";

const enrichBrandTool: AgentTool = {
  name: "enrich_brand",
  description: "Get brand information and contact details using StableEnrich API. Returns company data including domain, employees, revenue, description, and contacts.",
  autonomyLevel: "autonomous",
  costCategory: "mpp",
  maxCostPerUseCents: 200,
  parameters: {
    company_name: {
      type: "string",
      description: "Name of the company/brand to enrich",
      required: true,
    },
    domain: {
      type: "string",
      description: "Optional company domain (e.g., nike.com) to improve accuracy",
      required: false,
    },
  },
  async execute(params, context) {
    try {
      const { company_name, domain } = params as { company_name: string; domain?: string };
      
      const url = "https://stableenrich.com/api/v1/enrich";
      const requestBody: Record<string, string> = { company_name };
      
      if (domain) {
        requestBody.domain = domain;
      }

      const response = await context.mppFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          data: null,
          error: `StableEnrich API error: ${response.status} - ${errorText}`,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data,
        costCents: 150, // Typical enrichment cost
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error enriching brand",
      };
    }
  },
};

registerTool(enrichBrandTool);
