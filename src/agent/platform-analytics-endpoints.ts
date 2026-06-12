const PLATFORM_ANALYTICS_ENDPOINTS = {
  instagram: "https://stablesocial.dev/api/instagram/profile",
  tiktok: "https://stablesocial.dev/api/tiktok/profile",
  youtube: "https://stablesocial.dev/api/youtube/channel",
  twitter: "https://stablesocial.dev/api/twitter/profile",
  facebook: "https://stablesocial.dev/api/facebook/profile",
  reddit: "https://stablesocial.dev/api/reddit/profile",
} as const;

export type PlatformAnalyticsPlatform =
  keyof typeof PLATFORM_ANALYTICS_ENDPOINTS;

export const SUPPORTED_PLATFORM_ANALYTICS_PLATFORMS = Object.keys(
  PLATFORM_ANALYTICS_ENDPOINTS,
) as PlatformAnalyticsPlatform[];

export function getPlatformAnalyticsEndpoint(
  platform: string,
): string | undefined {
  return PLATFORM_ANALYTICS_ENDPOINTS[platform as PlatformAnalyticsPlatform];
}
