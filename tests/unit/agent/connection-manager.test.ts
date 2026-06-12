import { describe, expect, it, vi } from "vitest";

// Keep this test independent of the local Composio env config: only the native
// service set should count as supported here.
vi.mock("../../../src/integrations/composio.js", () => ({
  isComposioToolkit: () => false,
  getComposioToolkits: () => [],
}));

import { parseConnectionTargets } from "../../../src/agent/tools/connection-manager.js";

describe("parseConnectionTargets", () => {
  it("normalizes a comma-separated list of supported services", () => {
    const { supported, unsupported } = parseConnectionTargets(
      "YouTube, telegram, WhatsApp",
    );
    expect(supported.sort()).toEqual(["telegram", "whatsapp", "youtube"]);
    expect(unsupported).toEqual([]);
  });

  it("maps the twitter alias to x and dedupes", () => {
    const { supported } = parseConnectionTargets("twitter, x, X");
    expect(supported).toEqual(["x"]);
  });

  it("separates unsupported services", () => {
    const { supported, unsupported } = parseConnectionTargets(
      "youtube, gmail, slack",
    );
    expect(supported).toEqual(["youtube"]);
    expect(unsupported.sort()).toEqual(["gmail", "slack"]);
  });

  it("accepts an array input", () => {
    const { supported } = parseConnectionTargets(["instagram", "tiktok"]);
    expect(supported.sort()).toEqual(["instagram", "tiktok"]);
  });
});
