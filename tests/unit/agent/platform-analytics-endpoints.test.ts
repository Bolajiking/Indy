import { describe, expect, it } from "vitest";
import {
  getPlatformAnalyticsEndpoint,
  SUPPORTED_PLATFORM_ANALYTICS_PLATFORMS,
} from "../../../src/agent/platform-analytics-endpoints.js";

describe("platform analytics endpoints", () => {
  it("keeps the StableSocial endpoint catalog in one place", () => {
    expect(SUPPORTED_PLATFORM_ANALYTICS_PLATFORMS).toEqual([
      "instagram",
      "tiktok",
      "youtube",
      "twitter",
      "facebook",
      "reddit",
    ]);
    expect(getPlatformAnalyticsEndpoint("youtube")).toBe(
      "https://stablesocial.dev/api/youtube/channel",
    );
  });

  it("expects callers to decide how they normalize platform names", () => {
    expect(getPlatformAnalyticsEndpoint("YouTube")).toBeUndefined();
  });
});
