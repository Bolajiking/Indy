import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createApiServer } from "../../../src/api/server.js";
import { createWebhookRoutes } from "../../../src/api/routes/webhooks.js";
import { verifyWhatsAppSignature } from "../../../src/bot/whatsapp.js";

describe("Telegram webhook authentication", () => {
  const createApp = (mode: "disabled" | "polling" | "webhook") => {
    const processUpdate = vi.fn(
      async () => new Response("OK", { status: 200 }),
    );
    const app = createApiServer();
    app.route(
      "/webhooks",
      createWebhookRoutes({
        telegramMode: mode,
        telegramBot: {} as never,
        telegramWebhookSecret: "telegram-webhook-secret",
        telegramHandler: processUpdate,
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
});
