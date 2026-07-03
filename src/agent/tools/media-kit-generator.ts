import { readStringParam, registerTool, type AgentTool } from "./registry.js";

const mediaKitGeneratorTool: AgentTool = {
  name: "generate_media_kit",
  deferred: true,
  description:
    "Generate a visual media kit image for brand pitches — includes creator stats, audience demographics, and past brand work. Uses StableStudio via MPP for image generation.",
  autonomyLevel: "autonomous",
  costCategory: "mpp",
  maxCostPerUseCents: 200,
  parameters: {
    creator_name: {
      type: "string",
      description: "Creator's display name",
      required: true,
    },
    niche: {
      type: "string",
      description: "Creator's niche (e.g. 'tech reviews', 'fitness')",
      required: true,
    },
    follower_count: {
      type: "string",
      description: "Total followers across platforms (e.g. '250K')",
      required: true,
    },
    platforms: {
      type: "string",
      description:
        "Comma-separated platforms (e.g. 'YouTube, Instagram, TikTok')",
      required: true,
    },
    style: {
      type: "string",
      description:
        "Visual style: 'modern', 'minimal', 'bold', 'creative'. Defaults to 'modern'.",
      required: false,
    },
  },
  async execute(params, context) {
    const creatorName = readStringParam(params, "creator_name");
    const niche = readStringParam(params, "niche");
    const followerCount = readStringParam(params, "follower_count");
    const platforms = readStringParam(params, "platforms");
    const style = readStringParam(params, "style") ?? "modern";

    if (!creatorName || !niche || !followerCount || !platforms) {
      return {
        success: false,
        data: null,
        error:
          "creator_name, niche, follower_count, and platforms are required",
      };
    }

    const prompt = `Professional ${style} media kit design for content creator "${creatorName}". Niche: ${niche}. ${followerCount} followers across ${platforms}. Clean layout with stats, audience reach, and brand collaboration section. Professional branding, social media icons, high-quality design.`;

    try {
      const response = await context.mppFetch(
        "https://stablestudio.dev/api/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            width: 1200,
            height: 1600,
            format: "png",
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          data: null,
          error: `Media kit generation failed: ${response.status} - ${errorText}`,
        };
      }

      const data: unknown = await response.json();
      return {
        success: true,
        data: {
          message: `Media kit generated for ${creatorName}`,
          result: data,
        },
        costCents: 100,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error generating media kit",
      };
    }
  },
};

registerTool(mediaKitGeneratorTool);
