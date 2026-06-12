import { describe, expect, it } from "vitest";
import { getStoredYoutubeIdentity } from "../../../src/agent/connected-identities.js";

describe("getStoredYoutubeIdentity", () => {
  it("returns the captured channel identity", () => {
    const id = getStoredYoutubeIdentity({
      connected_identities: {
        youtube: { channelId: "UC123", title: "MrBeast", handle: "@mrbeast" },
      },
    });
    expect(id).toEqual({
      channelId: "UC123",
      title: "MrBeast",
      handle: "@mrbeast",
    });
  });

  it("ignores the 'no channel' sentinel (no channelId)", () => {
    expect(
      getStoredYoutubeIdentity({
        connected_identities: {
          youtube: { checkedAt: "2026-06-07T00:00:00Z" },
        },
      }),
    ).toBeUndefined();
  });

  it("returns undefined when nothing captured", () => {
    expect(getStoredYoutubeIdentity({})).toBeUndefined();
    expect(getStoredYoutubeIdentity(null)).toBeUndefined();
    expect(getStoredYoutubeIdentity(undefined)).toBeUndefined();
  });

  it("tolerates partial records (channelId only)", () => {
    expect(
      getStoredYoutubeIdentity({
        connected_identities: { youtube: { channelId: "UCabc" } },
      }),
    ).toEqual({ channelId: "UCabc", title: undefined, handle: undefined });
  });
});
