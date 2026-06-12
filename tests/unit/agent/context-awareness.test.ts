import { describe, expect, it } from "vitest";
import {
  buildConversationMessages,
  formatSetupGaps,
} from "../../../src/agent/memory.js";
import { channelNote } from "../../../src/agent/prompts.js";
import { asAgentChannel } from "../../../src/agent/types.js";

describe("formatSetupGaps", () => {
  const fullySetUp = {
    nicheSet: true,
    hasAnyConnection: true,
    reconnect: [] as string[],
    walletCreated: true,
    creditsCents: 500,
  };

  it("returns empty string when the account is fully set up", () => {
    expect(formatSetupGaps(fullySetUp)).toBe("");
  });

  it("surfaces a guided gap for each missing prerequisite", () => {
    const out = formatSetupGaps({
      nicheSet: false,
      hasAnyConnection: false,
      reconnect: ["youtube"],
      walletCreated: false,
      creditsCents: 0,
    });
    expect(out).toContain("Setup Gaps");
    expect(out).toContain("Niche not set");
    expect(out).toContain("No platforms or apps connected");
    expect(out).toContain("youtube");
    expect(out).toContain("Wallet not created");
    // Guidance must lead, not refuse
    expect(out).toContain("never refuse");
  });

  it("flags exhausted credits only when the wallet exists", () => {
    const out = formatSetupGaps({ ...fullySetUp, creditsCents: 0 });
    expect(out).toContain("Free credits exhausted");
    const noWallet = formatSetupGaps({
      ...fullySetUp,
      walletCreated: false,
      creditsCents: 0,
    });
    expect(noWallet).toContain("Wallet not created");
    expect(noWallet).not.toContain("Free credits exhausted");
  });
});

describe("buildConversationMessages", () => {
  it("attaches context to the only message when there is no history", () => {
    const messages = buildConversationMessages("CTX", [], "find me deals");
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toContain("<creator_context>\nCTX");
    expect(messages[0].content).toContain("find me deals");
  });

  it("replays history with alternating roles and merges the current message into a trailing user turn", () => {
    const messages = buildConversationMessages(
      "CTX",
      [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
        { role: "user", content: "scan for deals" },
      ],
      "scan for deals",
    );
    expect(messages[0].content).toContain("<creator_context>");
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(messages[2].content).toContain("scan for deals");
  });

  it("skips consecutive same-role history entries", () => {
    const messages = buildConversationMessages(
      "CTX",
      [
        { role: "user", content: "a" },
        { role: "user", content: "b" },
        { role: "assistant", content: "c" },
      ],
      "next",
    );
    expect(messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });
});

describe("channelNote", () => {
  it("tells messaging channels that connect cards do not render inline", () => {
    const note = channelNote("telegram");
    expect(note).toContain("telegram");
    expect(note).toContain("do NOT render");
    expect(note).toContain("dashboard");
  });

  it("tells the dashboard channel to rely on inline connect cards", () => {
    expect(channelNote("dashboard")).toContain("inline");
  });

  it("returns empty string for unknown or missing channels", () => {
    expect(channelNote(undefined)).toBe("");
    expect(channelNote("email")).toBe("");
  });
});

describe("asAgentChannel", () => {
  it("accepts only known channels", () => {
    expect(asAgentChannel("dashboard")).toBe("dashboard");
    expect(asAgentChannel("telegram")).toBe("telegram");
    expect(asAgentChannel("whatsapp")).toBe("whatsapp");
    expect(asAgentChannel("email")).toBeUndefined();
    expect(asAgentChannel(42)).toBeUndefined();
    expect(asAgentChannel(undefined)).toBeUndefined();
  });
});
