import pino from "pino";
import { getConnectionsForCreator } from "../../db/queries/platform-connections.js";

const log = pino({ name: "skill:analytics-aggregator" });

export interface PlatformStats {
  platform: string;
  username: string;
  followers?: number;
  engagementRate?: number;
  recentViews?: number;
  data: unknown;
  error?: string;
}

export interface AggregatedAnalytics {
  creatorId: string;
  collectedAt: string;
  platforms: PlatformStats[];
  totalFollowers: number;
  avgEngagementRate: number;
}

/**
 * Pull analytics from all connected platforms for a creator.
 * Uses the platform-analytics tool's endpoint pattern via direct fetch
 * (no MPP needed for the aggregator cron — it uses saved access tokens).
 */
export async function aggregateAnalytics(
  creatorId: string,
  mppFetch?: (url: string, options?: RequestInit) => Promise<Response>
): Promise<AggregatedAnalytics> {
  log.info({ creatorId }, "Aggregating platform analytics");

  const connections = await getConnectionsForCreator(creatorId);

  if (connections.length === 0) {
    log.info({ creatorId }, "No connected platforms — skipping analytics");
    return {
      creatorId,
      collectedAt: new Date().toISOString(),
      platforms: [],
      totalFollowers: 0,
      avgEngagementRate: 0,
    };
  }

  const platformEndpoints: Record<string, string> = {
    instagram: "https://stablesocial.dev/api/instagram/profile",
    tiktok: "https://stablesocial.dev/api/tiktok/profile",
    youtube: "https://stablesocial.dev/api/youtube/channel",
    twitter: "https://stablesocial.dev/api/twitter/profile",
    facebook: "https://stablesocial.dev/api/facebook/profile",
    reddit: "https://stablesocial.dev/api/reddit/profile",
  };

  const results: PlatformStats[] = [];
  const fetcher = mppFetch ?? fetch;

  for (const conn of connections) {
    const endpoint = platformEndpoints[conn.platform];
    if (!endpoint || !conn.platform_username) {
      results.push({
        platform: conn.platform,
        username: conn.platform_username ?? "unknown",
        data: null,
        error: endpoint ? "No username" : "Unsupported platform",
      });
      continue;
    }

    try {
      const url = new URL(endpoint);
      url.searchParams.set("username", conn.platform_username);

      const response = await fetcher(url.toString());

      if (!response.ok) {
        results.push({
          platform: conn.platform,
          username: conn.platform_username,
          data: null,
          error: `HTTP ${response.status}`,
        });
        continue;
      }

      const data = (await response.json()) as Record<string, unknown>;
      results.push({
        platform: conn.platform,
        username: conn.platform_username,
        followers: typeof data.followers === "number" ? data.followers : undefined,
        engagementRate:
          typeof data.engagement_rate === "number"
            ? data.engagement_rate
            : undefined,
        recentViews:
          typeof data.recent_views === "number" ? data.recent_views : undefined,
        data,
      });
    } catch (error) {
      log.error({ creatorId, platform: conn.platform, error }, "Analytics fetch failed");
      results.push({
        platform: conn.platform,
        username: conn.platform_username,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const validStats = results.filter((r) => r.followers != null);
  const totalFollowers = validStats.reduce((sum, r) => sum + (r.followers ?? 0), 0);
  const avgEngagementRate =
    validStats.length > 0
      ? validStats.reduce((sum, r) => sum + (r.engagementRate ?? 0), 0) /
        validStats.length
      : 0;

  log.info(
    { creatorId, platforms: results.length, totalFollowers },
    "Analytics aggregated"
  );

  return {
    creatorId,
    collectedAt: new Date().toISOString(),
    platforms: results,
    totalFollowers,
    avgEngagementRate,
  };
}
