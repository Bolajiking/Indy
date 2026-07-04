import crypto from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SUPABASE_URL ??= "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_KEY ??= "test-service-key";
  process.env.PRIVY_APP_ID ??= "test-privy-app";
  process.env.PRIVY_APP_SECRET ??= "test-privy-secret";
});

import { createApiServer } from "../../src/api/server.js";
import { createWebhookRoutes } from "../../src/api/routes/webhooks.js";

describe("webhook idempotency", () => {
  it("accepts a duplicate signed WhatsApp message with one durable claim and side effect", async () => {
    const claims = new Set<string>();
    const jobs = new Map<string, unknown>();
    const sideEffect = vi.fn();
    const claimWebhookEvent = vi.fn(async (input) => {
      const key = `${input.provider}:${input.providerEventId}`;
      const claimed = !claims.has(key);
      claims.add(key);
      return { claimed, status: "queued" as const };
    });
    const enqueueWebhook = vi.fn(async (job) => {
      const key = `${job.provider}:${job.providerEventId}`;
      if (!jobs.has(key)) jobs.set(key, job);
    });
    const payload = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  {
                    id: "wamid.duplicate-1",
                    from: "2348000000000",
                    type: "text",
                    text: { body: "private content" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const secret = "meta-app-secret";
    const signature = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex")}`;
    const app = createApiServer();
    app.route(
      "/webhooks",
      createWebhookRoutes({
        whatsappEnabled: true,
        whatsappWebhookSecret: secret,
        claimWebhookEvent,
        enqueueWebhook,
      }),
    );

    const deliver = () =>
      app.request("/webhooks/whatsapp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-hub-signature-256": signature,
        },
        body: payload,
      });
    const [first, second] = await Promise.all([deliver(), deliver()]);

    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(claims).toHaveLength(1);
    expect(jobs).toHaveLength(1);
    expect(claimWebhookEvent).toHaveBeenCalledWith({
      provider: "whatsapp",
      providerEventId: "wamid.duplicate-1",
      payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(claimWebhookEvent.mock.calls)).not.toContain(
      "private content",
    );

    for (const job of jobs.values()) await sideEffect(job);
    expect(sideEffect).toHaveBeenCalledOnce();
  });

  it("re-enqueues an existing unprocessed claim after an earlier queue failure", async () => {
    let enqueueAttempt = 0;
    const app = createApiServer();
    app.route(
      "/webhooks",
      createWebhookRoutes({
        telegramMode: "webhook",
        telegramBot: {} as never,
        telegramWebhookSecret: "secret",
        claimWebhookEvent: vi
          .fn()
          .mockResolvedValueOnce({ claimed: true, status: "queued" })
          .mockResolvedValueOnce({ claimed: false, status: "queued" }),
        enqueueWebhook: vi.fn(async () => {
          enqueueAttempt += 1;
          if (enqueueAttempt === 1) throw new Error("Redis unavailable");
        }),
      }),
    );
    const deliver = () =>
      app.request("/webhooks/telegram", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": "secret",
        },
        body: JSON.stringify({ update_id: 99, message: { text: "hello" } }),
      });

    expect((await deliver()).status).toBe(503);
    expect((await deliver()).status).toBe(202);
    expect(enqueueAttempt).toBe(2);
  });
});
