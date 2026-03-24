import { registerTool, type AgentTool } from "./registry.js";

const platformAnalyticsTool: AgentTool = {
  name: "get_platform_analytics",
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
    const { platform, username } = params as {
      platform: string;
      username: string;
    };

    const platformEndpoints: Record<string, string> = {
      instagram: "https://stablesocial.dev/api/instagram/profile",
      tiktok: "https://stablesocial.dev/api/tiktok/profile",
      youtube: "https://stablesocial.dev/api/youtube/channel",
      twitter: "https://stablesocial.dev/api/twitter/profile",
      facebook: "https://stablesocial.dev/api/facebook/profile",
      reddit: "https://stablesocial.dev/api/reddit/profile",
    };

    const endpoint = platformEndpoints[platform.toLowerCase()];
    if (!endpoint) {
      return {
        success: false,
        data: null,
        error: `Unsupported platform: ${platform}. Supported: ${Object.keys(platformEndpoints).join(", ")}`,
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

      const data = await response.json();
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
