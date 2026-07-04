import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createApiServer } from "../../../src/api/server.js";
import { createWebhookRoutes } from "../../../src/api/routes/webhooks.js";
import {
  verifyWhatsAppSignature,
  verifyWhatsAppWebhook,
} from "../../../src/bot/whatsapp.js";

describe("Telegram webhook authentication", () => {
  const createApp = (
    mode: "disabled" | "polling" | "webhook",
    options: {
      botAvailable?: boolean;
      telegramHandlerFactory?: () => ReturnType<typeof vi.fn>;
    } = {},
  ) => {
    const processUpdate = vi.fn(
      async () => new Response("OK", { status: 200 }),
    );
    const app = createApiServer();
    app.route(
      "/webhooks",
      createWebhookRoutes({
        telegramMode: mode,
        telegramBot: options.botAvailable === false ? null : ({} as never),
        telegramWebhookSecret: "telegram-webhook-secret",
        telegramHandler: options.telegramHandlerFactory
          ? undefined
          : processUpdate,
        telegramHandlerFactory: options.telegramHandlerFactory,
      }),
    );
    return { app, processUpdate };
  };

  it.each([undefined, "wrong-secret"])(
    "returns 401 before processing a request with secret %s",
    async (secret) => {
      const { app, processUpdate } = createApp("webhook");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (secret) headers["X-Telegram-Bot-Api-Secret-Token"] = secret;

      const response = await app.request("/webhooks/telegram", {
        method: "POST",
        headers,
        body: JSON.stringify({ update_id: 1 }),
      });

      expect(response.status).toBe(401);
      expect(processUpdate).not.toHaveBeenCalled();
    },
  );

  it("rejects an equal-length incorrect secret", async () => {
    const { app, processUpdate } = createApp("webhook");
    const response = await app.request("/webhooks/telegram", {
      method: "POST",
      headers: {
        "X-Telegram-Bot-Api-Secret-Token": "x".repeat(
          "telegram-webhook-secret".length,
        ),
      },
    });

    expect(response.status).toBe(401);
    expect(processUpdate).not.toHaveBeenCalled();
  });

  it("processes a request whose secret exactly matches", async () => {
    const { app, processUpdate } = createApp("webhook");

    const response = await app.request("/webhooks/telegram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "telegram-webhook-secret",
      },
      body: JSON.stringify({ update_id: 1 }),
    });

    expect(response.status).toBe(200);
    expect(processUpdate).toHaveBeenCalledOnce();
  });

  it("initializes the grammY webhook handler once for repeated requests", async () => {
    const handler = vi.fn(async () => new Response("OK", { status: 200 }));
    const telegramHandlerFactory = vi.fn(() => handler);
    const { app } = createApp("webhook", { telegramHandlerFactory });

    for (const updateId of [1, 2]) {
      const response = await app.request("/webhooks/telegram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Bot-Api-Secret-Token": "telegram-webhook-secret",
        },
        body: JSON.stringify({ update_id: updateId }),
      });
      expect(response.status).toBe(200);
    }

    expect(telegramHandlerFactory).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, "wrong-secret"])(
    "returns 401 before revealing absent bot state for secret %s",
    async (secret) => {
      const { app, processUpdate } = createApp("webhook", {
        botAvailable: false,
      });
      const headers: Record<string, string> = {};
      if (secret) headers["X-Telegram-Bot-Api-Secret-Token"] = secret;

      const response = await app.request("/webhooks/telegram", {
        method: "POST",
        headers,
      });

      expect(response.status).toBe(401);
      expect(processUpdate).not.toHaveBeenCalled();
    },
  );

  it("returns 503 only after authenticating a request when the bot is absent", async () => {
    const { app, processUpdate } = createApp("webhook", {
      botAvailable: false,
    });

    const response = await app.request("/webhooks/telegram", {
      method: "POST",
      headers: {
        "X-Telegram-Bot-Api-Secret-Token": "telegram-webhook-secret",
      },
    });

    expect(response.status).toBe(503);
    expect(processUpdate).not.toHaveBeenCalled();
  });

  it.each(["disabled", "polling"] as const)(
    "returns 404 without processing in %s mode",
    async (mode) => {
      const { app, processUpdate } = createApp(mode);

      const response = await app.request("/webhooks/telegram", {
        method: "POST",
        headers: {
          "X-Telegram-Bot-Api-Secret-Token": "telegram-webhook-secret",
        },
      });

      expect(response.status).toBe(404);
      expect(processUpdate).not.toHaveBeenCalled();
    },
  );
});

describe("WhatsApp webhook signatures", () => {
  const payload = JSON.stringify({ object: "whatsapp_business_account" });
  const secret = "meta-app-secret";

  it("accepts a correct sha256 signature", () => {
    const digest = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    expect(verifyWhatsAppSignature(payload, `sha256=${digest}`, secret)).toBe(
      true,
    );
  });

  it.each([
    undefined,
    "",
    "sha256=wrong",
    "sha256=abc",
    "sha256=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
    "md5=88d4266fd4e6338d13b845fcf289579d",
  ])(
    "rejects a missing, incorrect, or malformed signature: %s",
    (signature) => {
      expect(verifyWhatsAppSignature(payload, signature, secret)).toBe(false);
    },
  );

  it("fails closed when the app secret is missing", () => {
    const digest = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    expect(verifyWhatsAppSignature(payload, `sha256=${digest}`, "")).toBe(
      false,
    );
  });

  it("rejects a valid signature when the payload is altered", () => {
    const digest = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    expect(
      verifyWhatsAppSignature(`${payload} `, `sha256=${digest}`, secret),
    ).toBe(false);
  });
});

describe("WhatsApp webhook enablement", () => {
  const createApp = (whatsappEnabled: boolean) => {
    const app = createApiServer();
    app.route(
      "/webhooks",
      createWebhookRoutes({ whatsappEnabled, whatsappVerifyToken: "" }),
    );
    return app;
  };

  it.each([
    [
      "GET",
      "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=&hub.challenge=x",
    ],
    ["POST", "/webhooks/whatsapp"],
  ])(
    "returns 404 for %s before parsing while disabled",
    async (method, path) => {
      const response = await createApp(false).request(path, {
        method,
        body: method === "POST" ? "not-json" : undefined,
      });

      expect(response.status).toBe(404);
    },
  );

  it("rejects verification when the configured token and supplied token are empty", async () => {
    const response = await createApp(true).request(
      "/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=&hub.challenge=x",
    );

    expect(response.status).toBe(403);
    expect(
      verifyWhatsAppWebhook(
        { "hub.mode": "subscribe", "hub.verify_token": "" },
        "",
      ).ok,
    ).toBe(false);
  });
});
