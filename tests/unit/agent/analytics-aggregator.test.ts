import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/queries/platform-connections.js", () => ({
  getConnectionsForCreator: vi.fn().mockResolvedValue([]),
}));

import { aggregateAnalytics } from "../../../src/agent/skills/analytics-aggregator.js";

describe("analytics-aggregator", () => {
  it("returns empty analytics when no platforms are connected", async () => {
    const result = await aggregateAnalytics("creator-1");

    expect(result.creatorId).toBe("creator-1");
    expect(result.platforms).toHaveLength(0);
    expect(result.totalFollowers).toBe(0);
    expect(result.avgEngagementRate).toBe(0);
    expect(result.collectedAt).toBeDefined();
  });
});
