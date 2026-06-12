import { describe, expect, it, vi } from "vitest";

const { constructorSpy } = vi.hoisted(() => ({
  constructorSpy: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    constructor(options: unknown) {
      constructorSpy(options);
    }
  },
}));

import anthropic from "../../../src/agent/anthropic.js";
import { ipv4Fetch } from "../../../src/network/ipv4-fetch.js";

describe("shared anthropic client", () => {
  it("uses the IPv4-safe fetch transport", () => {
    expect(anthropic).toBeTruthy();
    expect(constructorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: expect.any(String),
        fetch: ipv4Fetch,
      }),
    );
  });
});
