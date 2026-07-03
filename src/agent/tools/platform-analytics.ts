import { readStringParam, registerTool, type AgentTool } from "./registry.js";
import {
  getPlatformAnalyticsEndpoint,
  SUPPORTED_PLATFORM_ANALYTICS_PLATFORMS,
} from "../platform-analytics-endpoints.js";

const platformAnalyticsTool: AgentTool = {
  name: "get_platform_analytics",
  deferred: true,
  description:
    "Fetch social media analytics for a creator's account — followers, engagement rate, recent post performance. Uses StableSocial via MPP. Supports Instagram, TikTok, YouTube, Twitter/X.",
  autonomyLevel: "autonomous",
  costCategory: "mpp",
  maxCostPerUseCents: 100,
  parameters: {
    platform: {
      type: "string",
      description:
        "Social platform: instagram, tiktok, youtube, twitter, facebook, reddit",
      required: true,
    },
    username: {
      type: "string",
      description: "Username or handle on the platform (without @)",
      required: true,
    },
  },
  async execute(params, context) {
    const platform = readStringParam(params, "platform");
    const username = readStringParam(params, "username");

    if (!platform || !username) {
      return {
        success: false,
        data: null,
        error: "platform and username are required",
      };
    }

    const endpoint = getPlatformAnalyticsEndpoint(platform.toLowerCase());
    if (!endpoint) {
      return {
        success: false,
        data: null,
        error: `Unsupported platform: ${platform}. Supported: ${SUPPORTED_PLATFORM_ANALYTICS_PLATFORMS.join(", ")}`,
      };
    }

    try {
      const url = new URL(endpoint);
      url.searchParams.set("username", username);

      const response = await context.mppFetch(url.toString());

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          data: null,
          error: `Platform analytics failed: ${response.status} - ${errorText}`,
        };
      }

      const data: unknown = await response.json();
      return {
        success: true,
        data,
        costCents: 50,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error fetching analytics",
      };
    }
  },
};

registerTool(platformAnalyticsTool);
