import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  constructorSpy,
  setMyCommands,
  onSpy,
  catchSpy,
} = vi.hoisted(() => ({
  constructorSpy: vi.fn(),
  setMyCommands: vi.fn().mockResolvedValue(undefined),
  onSpy: vi.fn(),
  catchSpy: vi.fn(),
}));

vi.mock("grammy", () => {
  class MockBot {
    api = {
      setMyCommands,
    };

    constructor(token: string, config?: unknown) {
      constructorSpy(token, config);
    }

    on = onSpy;
    catch = catchSpy;
  }

  class MockInlineKeyboard {
    text() {
      return this;
    }
  }

  return {
    Bot: MockBot,
    InlineKeyboard: MockInlineKeyboard,
  };
});

import { createTelegramBot } from "../../../src/bot/telegram.js";
import { ipv4Fetch } from "../../../src/network/ipv4-fetch.js";

describe("createTelegramBot", () => {
  beforeEach(() => {
    constructorSpy.mockClear();
    setMyCommands.mockClear();
    onSpy.mockClear();
    catchSpy.mockClear();
  });

  it("constructs grammY with the IPv4-safe fetch client", () => {
    createTelegramBot();

    expect(constructorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        client: expect.objectContaining({
          fetch: ipv4Fetch,
        }),
      })
    );
    expect(setMyCommands).toHaveBeenCalledOnce();
  });
});
