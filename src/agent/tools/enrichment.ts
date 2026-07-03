import { readStringParam, registerTool, type AgentTool } from "./registry.js";
import { findService as defaultFindService } from "./x402-registry.js";

const enrichBrandTool: AgentTool = {
  name: "enrich_brand",
  deferred: true,
  description:
    "Get brand information and contact details using StableEnrich API. Returns company data including domain, employees, revenue, description, and contacts.",
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
      description:
        "Optional company domain (e.g., nike.com) to improve accuracy",
      required: false,
    },
  },
  async execute(params, context) {
    try {
      const companyName = readStringParam(params, "company_name");
      if (!companyName) {
        return {
          success: false,
          data: null,
          error: "company_name is required",
        };
      }
      const domain = readStringParam(params, "domain");
      const findService = context.findService ?? defaultFindService;
      let service;

      try {
        service = await findService("brand_enrichment");
      } catch (error) {
        return {
          success: false,
          data: null,
          error: `Service discovery failed for capability brand_enrichment: ${
            error instanceof Error ? error.message : "Unknown discovery error"
          }`,
        };
      }

      if (!service) {
        return {
          success: false,
          data: null,
          error: "No paid service available for capability brand_enrichment",
        };
      }

      const requestBody: Record<string, string> = { company_name: companyName };

      if (domain) {
        requestBody.domain = domain;
      }

      const response = await context.mppFetch(service.url, {
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
          error: `${service.name} API error: ${response.status} - ${errorText}`,
        };
      }

      const data: unknown = await response.json();

      return {
        success: true,
        data,
        costCents: service.estimatedCostCents,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error enriching brand",
      };
    }
  },
};

registerTool(enrichBrandTool);
