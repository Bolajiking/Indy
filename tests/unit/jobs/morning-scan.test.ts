import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/agent/skills/brand-deal-scanner.js", () => ({
  scanForBrandDeals: vi.fn(),
}));

vi.mock("../../../src/db/queries/creators.js", () => ({
  getCreatorById: vi.fn(),
  listCreatorsForMorningScans: vi.fn(),
}));

vi.mock("../../../src/db/queries/platform-connections.js", () => ({
  getConnectionsForCreator: vi.fn(),
}));

import { scanForBrandDeals } from "../../../src/agent/skills/brand-deal-scanner.js";
import {
  getCreatorById,
  listCreatorsForMorningScans,
} from "../../../src/db/queries/creators.js";
import { getConnectionsForCreator } from "../../../src/db/queries/platform-connections.js";
import { runMorningScan } from "../../../src/jobs/morning-scan.js";

describe("runMorningScan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scans a single creator using their niche and connected platforms", async () => {
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-1",
      niche: "fitness",
    } as never);
    vi.mocked(getConnectionsForCreator).mockResolvedValue([
      { platform: "instagram" },
      { platform: "youtube" },
    ] as never);

    await runMorningScan("creator-1");

    expect(scanForBrandDeals).toHaveBeenCalledWith("creator-1", "fitness", [
      "instagram",
      "youtube",
    ]);
  });

  it("runs scans for every creator with a niche when no creator id is provided", async () => {
    vi.mocked(listCreatorsForMorningScans).mockResolvedValue([
      { id: "creator-1", niche: "finance" },
      { id: "creator-2", niche: null },
      { id: "creator-3", niche: "beauty" },
    ] as never);
    vi.mocked(getCreatorById).mockImplementation(async (creatorId: string) => {
      if (creatorId === "creator-2") {
        return { id: creatorId, niche: null } as never;
      }

      return {
        id: creatorId,
        niche: creatorId === "creator-1" ? "finance" : "beauty",
      } as never;
    });
    vi.mocked(getConnectionsForCreator).mockResolvedValue([
      { platform: "tiktok" },
    ] as never);

    await runMorningScan();

    expect(scanForBrandDeals).toHaveBeenCalledTimes(2);
    expect(scanForBrandDeals).toHaveBeenNthCalledWith(
      1,
      "creator-1",
      "finance",
      ["tiktok"],
    );
    expect(scanForBrandDeals).toHaveBeenNthCalledWith(
      2,
      "creator-3",
      "beauty",
      ["tiktok"],
    );
  });
});
