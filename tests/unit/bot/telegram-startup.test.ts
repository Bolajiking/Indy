import { beforeEach, describe, expect, it, vi } from "vitest";

const { constructorSpy, setMyCommands, onSpy, catchSpy } = vi.hoisted(() => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";

  return {
    constructorSpy: vi.fn(),
    setMyCommands: vi.fn().mockResolvedValue(undefined),
    onSpy: vi.fn(),
    catchSpy: vi.fn(),
  };
});

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
import { startTelegramMode } from "../../../src/index.js";
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
      }),
    );
    expect(setMyCommands).toHaveBeenCalledOnce();
  });
});

describe("startTelegramMode", () => {
  const makeDependencies = () => {
    const bot = {
      start: vi.fn().mockResolvedValue(undefined),
    };

    return {
      bot,
      createBot: vi.fn(() => bot),
      registerBot: vi.fn(),
      registerWebhook: vi.fn(),
    };
  };

  it("starts polling only in polling mode", () => {
    const dependencies = makeDependencies();

    const bot = startTelegramMode({
      enabled: true,
      configured: true,
      mode: "polling",
      ...dependencies,
    });

    expect(bot).toBe(dependencies.bot);
    expect(dependencies.createBot).toHaveBeenCalledOnce();
    expect(dependencies.registerBot).toHaveBeenCalledWith(dependencies.bot);
    expect(dependencies.registerWebhook).not.toHaveBeenCalled();
    expect(dependencies.bot.start).toHaveBeenCalledOnce();
  });

  it("registers webhook mode without starting polling", () => {
    const dependencies = makeDependencies();

    const bot = startTelegramMode({
      enabled: true,
      configured: true,
      mode: "webhook",
      ...dependencies,
    });

    expect(bot).toBe(dependencies.bot);
    expect(dependencies.createBot).toHaveBeenCalledOnce();
    expect(dependencies.registerBot).toHaveBeenCalledWith(dependencies.bot);
    expect(dependencies.registerWebhook).toHaveBeenCalledWith(dependencies.bot);
    expect(dependencies.bot.start).not.toHaveBeenCalled();
  });

  it("creates no bot in disabled mode", () => {
    const dependencies = makeDependencies();

    const bot = startTelegramMode({
      enabled: true,
      configured: true,
      mode: "disabled",
      ...dependencies,
    });

    expect(bot).toBeNull();
    expect(dependencies.createBot).not.toHaveBeenCalled();
    expect(dependencies.registerBot).not.toHaveBeenCalled();
    expect(dependencies.registerWebhook).not.toHaveBeenCalled();
    expect(dependencies.bot.start).not.toHaveBeenCalled();
  });

  it("creates no bot when Telegram is disabled by feature flag", () => {
    const dependencies = makeDependencies();

    const bot = startTelegramMode({
      enabled: false,
      configured: true,
      mode: "polling",
      ...dependencies,
    });

    expect(bot).toBeNull();
    expect(dependencies.createBot).not.toHaveBeenCalled();
    expect(dependencies.registerBot).not.toHaveBeenCalled();
    expect(dependencies.registerWebhook).not.toHaveBeenCalled();
    expect(dependencies.bot.start).not.toHaveBeenCalled();
  });

  it("creates no bot when Telegram is not configured", () => {
    const dependencies = makeDependencies();

    const bot = startTelegramMode({
      enabled: true,
      configured: false,
      mode: "polling",
      ...dependencies,
    });

    expect(bot).toBeNull();
    expect(dependencies.createBot).not.toHaveBeenCalled();
    expect(dependencies.registerBot).not.toHaveBeenCalled();
    expect(dependencies.registerWebhook).not.toHaveBeenCalled();
    expect(dependencies.bot.start).not.toHaveBeenCalled();
  });

  it("contains a rejected polling start without making startup throw", async () => {
    const dependencies = makeDependencies();
    dependencies.bot.start.mockRejectedValueOnce(new Error("polling failed"));

    expect(() =>
      startTelegramMode({
        enabled: true,
        configured: true,
        mode: "polling",
        ...dependencies,
      }),
    ).not.toThrow();

    await vi.waitFor(() => {
      expect(dependencies.bot.start).toHaveBeenCalledOnce();
    });
    expect(dependencies.registerWebhook).not.toHaveBeenCalled();
  });
});
