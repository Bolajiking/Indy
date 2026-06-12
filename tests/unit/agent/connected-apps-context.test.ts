import { describe, expect, it } from "vitest";
import { formatConnectedApps } from "../../../src/agent/memory.js";

describe("formatConnectedApps", () => {
  it("lists Composio-connected apps so the agent never claims they're unconnected", () => {
    // The original bug: YouTube connected via Composio, but the context said
    // "None connected yet" (native table only), so the agent denied access.
    const out = formatConnectedApps([], {
      connected: ["gmail", "youtube"],
      reconnect: [],
    });
    expect(out).toContain("gmail (connected");
    expect(out).toContain("youtube (connected");
    expect(out).not.toContain("None connected");
  });

  it("merges native platform connections with Composio apps", () => {
    const out = formatConnectedApps(
      [{ platform: "instagram", platform_username: "creator" }],
      { connected: ["gmail"], reconnect: [] },
    );
    expect(out).toContain("instagram: @creator (connected)");
    expect(out).toContain("gmail (connected");
  });

  it("flags expired Composio links as needing reconnect", () => {
    const out = formatConnectedApps([], {
      connected: ["gmail"],
      reconnect: ["youtube"],
    });
    expect(out).toContain("gmail (connected");
    expect(out).toContain("youtube (was connected but the link expired");
  });

  it("does not duplicate an app connected both natively and via Composio", () => {
    const out = formatConnectedApps(
      [{ platform: "youtube", platform_username: "chan" }],
      { connected: ["youtube"], reconnect: [] },
    );
    // Native row wins; the Composio duplicate is suppressed.
    expect(out).toContain("youtube: @chan (connected)");
    expect(out.match(/youtube/g)?.length).toBe(1);
  });

  it("falls back to 'None connected yet' when truly empty", () => {
    expect(formatConnectedApps([], { connected: [], reconnect: [] })).toContain(
      "None connected yet",
    );
  });
});
