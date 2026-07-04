import crypto from "node:crypto";
import type { Bot } from "grammy";
import type { JobsOptions, Queue } from "bullmq";
import type { WebhookProvider } from "../db/queries/webhook-events.js";

export interface WebhookDeliveryData {
  provider: WebhookProvider;
  providerEventId: string;
  payload: unknown;
}

export const WEBHOOK_DELIVERY_TIMEOUT_MS = 30_000;

type WebhookJob = {
  data: WebhookDeliveryData;
  attemptsMade: number;
  opts: { attempts?: number };
};

export const WEBHOOK_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { age: 86_400, count: 10_000 },
  removeOnFail: { age: 604_800, count: 10_000 },
};

export function getWebhookJobId(
  provider: WebhookProvider,
  providerEventId: string,
): string {
  const digest = crypto
    .createHash("sha256")
    .update(`${provider}\0${providerEventId}`)
    .digest("hex");
  return `webhook-${digest}`;
}

export async function enqueueWebhookDelivery(
  queue: Pick<Queue, "add">,
  data: WebhookDeliveryData,
): Promise<void> {
  await queue.add("webhook-delivery", data, {
    ...WEBHOOK_JOB_OPTIONS,
    jobId: getWebhookJobId(data.provider, data.providerEventId),
  });
}

export interface WebhookDeliveryDependencies {
  processTelegram: (payload: unknown) => Promise<void>;
  processWhatsApp: (payload: unknown, providerEventId: string) => Promise<void>;
  markAttempt: (
    provider: WebhookProvider,
    providerEventId: string,
    attemptCount: number,
  ) => Promise<void>;
  markProcessed: (
    provider: WebhookProvider,
    providerEventId: string,
  ) => Promise<void>;
  markFailed: (
    provider: WebhookProvider,
    providerEventId: string,
    attemptCount: number,
    redactedError: string,
  ) => Promise<void>;
}

export function createWebhookDeliveryProcessor(
  dependencies: WebhookDeliveryDependencies,
) {
  return async (job: WebhookJob): Promise<void> => {
    const { provider, providerEventId, payload } = job.data;
    const attempt = job.attemptsMade + 1;
    await dependencies.markAttempt(provider, providerEventId, attempt);

    try {
      const delivery =
        provider === "telegram"
          ? dependencies.processTelegram(payload)
          : dependencies.processWhatsApp(payload, providerEventId);
      let timeout: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        delivery,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error("Webhook delivery timed out")),
            WEBHOOK_DELIVERY_TIMEOUT_MS,
          );
          timeout.unref?.();
        }),
      ]).finally(() => clearTimeout(timeout));
      await dependencies.markProcessed(provider, providerEventId);
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      if (attempt >= maxAttempts) {
        await dependencies.markFailed(
          provider,
          providerEventId,
          attempt,
          "Webhook delivery failed",
        );
      }
      throw error;
    }
  };
}

export function createDefaultWebhookDeliveryProcessor(telegramBot: Bot | null) {
  return createWebhookDeliveryProcessor({
    processTelegram: async (payload) => {
      if (!telegramBot) throw new Error("Telegram bot is unavailable");
      await telegramBot.handleUpdate(payload as never);
    },
    processWhatsApp: async (payload, providerEventId) => {
      const { handleWhatsAppWebhookPayload, sendWhatsAppMessage } =
        await import("../bot/whatsapp.js");
      const responses = await handleWhatsAppWebhookPayload(
        payload,
        providerEventId,
      );
      await Promise.all(
        responses.map(({ to, response }) => sendWhatsAppMessage(to, response)),
      );
    },
    markAttempt: async (...args) => {
      const { markWebhookAttempt } =
        await import("../db/queries/webhook-events.js");
      await markWebhookAttempt(...args);
    },
    markProcessed: async (...args) => {
      const { markWebhookProcessed } =
        await import("../db/queries/webhook-events.js");
      await markWebhookProcessed(...args);
    },
    markFailed: async (...args) => {
      const { markWebhookFailed } =
        await import("../db/queries/webhook-events.js");
      await markWebhookFailed(...args);
    },
  });
}
