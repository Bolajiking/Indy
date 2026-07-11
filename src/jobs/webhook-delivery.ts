import crypto from "node:crypto";
import type { Bot } from "grammy";
import { UnrecoverableError, type JobsOptions, type Queue } from "bullmq";
import type { WebhookProvider } from "../db/queries/webhook-events.js";
import { getRequestId } from "../observability/request-context.js";

export interface WebhookDeliveryData {
  provider: WebhookProvider;
  providerEventId: string;
  payload: unknown;
  requestId?: string;
}

export const WEBHOOK_DELIVERY_TIMEOUT_MS = 30_000;

/**
 * Provider adapters may throw this only before invoking an outbound provider
 * operation. Its explicit type, rather than an error-message convention,
 * allows the job to release its lease and use BullMQ's bounded retry policy.
 */
export class RetryableWebhookPreDeliveryError extends Error {
  override name = "RetryableWebhookPreDeliveryError";
}

type WebhookJob = {
  data: WebhookDeliveryData;
  attemptsMade: number;
  opts: { attempts?: number };
};

export const WEBHOOK_JOB_OPTIONS: JobsOptions = {
  // BullMQ retries safe failures before a provider handler acquires and starts
  // a delivery. Once an external effect may have started, the processor raises
  // UnrecoverableError and requires reconciliation instead of replaying it.
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
  await queue.add(
    "webhook-delivery",
    { ...data, requestId: data.requestId ?? getRequestId() },
    {
      ...WEBHOOK_JOB_OPTIONS,
      jobId: getWebhookJobId(data.provider, data.providerEventId),
    },
  );
}

export interface WebhookDeliveryDependencies {
  processTelegram: (payload: unknown) => Promise<void>;
  processWhatsApp: (payload: unknown, providerEventId: string) => Promise<void>;
  acquireDelivery: (
    provider: WebhookProvider,
    providerEventId: string,
    attemptCount: number,
    leaseToken: string,
  ) => Promise<boolean>;
  markProcessed: (
    provider: WebhookProvider,
    providerEventId: string,
    leaseToken: string,
  ) => Promise<void>;
  markOutcomeUnknown: (
    provider: WebhookProvider,
    providerEventId: string,
    leaseToken: string,
    redactedError: string,
  ) => Promise<void>;
  markPendingLeaseOutcomeUnknown: (
    provider: WebhookProvider,
    providerEventId: string,
  ) => Promise<void>;
  releaseForRetry: (
    provider: WebhookProvider,
    providerEventId: string,
    attemptCount: number,
    leaseToken: string,
  ) => Promise<void>;
  markFailed: (
    provider: WebhookProvider,
    providerEventId: string,
    attemptCount: number,
    leaseToken: string,
    redactedError: string,
  ) => Promise<void>;
}

export function createWebhookDeliveryProcessor(
  dependencies: WebhookDeliveryDependencies,
) {
  return async (job: WebhookJob): Promise<void> => {
    const { provider, providerEventId, payload } = job.data;
    const attempt = job.attemptsMade + 1;
    const leaseToken = crypto.randomUUID();
    const acquired = await dependencies.acquireDelivery(
      provider,
      providerEventId,
      attempt,
      leaseToken,
    );
    if (!acquired) {
      // This can be a recovered job after the prior worker died immediately
      // after leasing. Do not re-run it: preserve that prior token for a late
      // success and make the uncertain result visible to reconciliation.
      await dependencies.markPendingLeaseOutcomeUnknown(
        provider,
        providerEventId,
      );
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutError = new Error("Webhook delivery timed out");
    const delivery = Promise.resolve().then(() =>
      provider === "telegram"
        ? dependencies.processTelegram(payload)
        : dependencies.processWhatsApp(payload, providerEventId),
    );
    try {
      await Promise.race([
        delivery,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(timeoutError),
            WEBHOOK_DELIVERY_TIMEOUT_MS,
          );
          timeout.unref?.();
        }),
      ]);
      await dependencies.markProcessed(provider, providerEventId, leaseToken);
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof RetryableWebhookPreDeliveryError) {
        const maximumAttempts = job.opts.attempts ?? 1;
        if (attempt >= maximumAttempts) {
          await dependencies.markFailed(
            provider,
            providerEventId,
            attempt,
            leaseToken,
            "Webhook delivery failed before provider invocation",
          );
          throw new UnrecoverableError(
            "Webhook delivery failed before provider invocation",
          );
        }

        await dependencies.releaseForRetry(
          provider,
          providerEventId,
          attempt,
          leaseToken,
        );
        throw error;
      }

      // A provider handler can emit an external side effect immediately before
      // rejecting, timing out, or losing the DB response that records success.
      // Replaying that ambiguous attempt risks sending the user a duplicate
      // message, so it is intentionally not retried by BullMQ. A later success
      // from a timed-out handler may still confirm the same token-bound lease.
      try {
        await dependencies.markOutcomeUnknown(
          provider,
          providerEventId,
          leaseToken,
          "Webhook delivery outcome requires reconciliation",
        );
      } catch {
        // Do not retry an ambiguous provider delivery even if recording its
        // outcome also fails. The worker's terminal failure remains visible.
      }
      if (error === timeoutError) {
        void delivery.then(
          async () => {
            try {
              await dependencies.markProcessed(
                provider,
                providerEventId,
                leaseToken,
              );
            } catch {
              // The durable unknown outcome above remains the safe state.
            }
          },
          () => undefined,
        );
      }
      throw new UnrecoverableError(
        "Webhook delivery outcome requires reconciliation",
      );
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function createDefaultWebhookDeliveryProcessor(telegramBot: Bot | null) {
  return createWebhookDeliveryProcessor({
    processTelegram: async (payload) => {
      if (!telegramBot) {
        throw new RetryableWebhookPreDeliveryError(
          "Telegram bot is unavailable",
        );
      }
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
    acquireDelivery: async (provider, providerEventId, attemptCount, token) => {
      const { acquireWebhookDelivery } =
        await import("../db/queries/webhook-events.js");
      return acquireWebhookDelivery({
        provider,
        providerEventId,
        attemptCount,
        leaseToken: token,
      });
    },
    markProcessed: async (...args) => {
      const { markWebhookProcessed } =
        await import("../db/queries/webhook-events.js");
      await markWebhookProcessed(...args);
    },
    markOutcomeUnknown: async (...args) => {
      const { markWebhookOutcomeUnknown } =
        await import("../db/queries/webhook-events.js");
      await markWebhookOutcomeUnknown(...args);
    },
    markPendingLeaseOutcomeUnknown: async (...args) => {
      const { markPendingWebhookLeaseOutcomeUnknown } =
        await import("../db/queries/webhook-events.js");
      await markPendingWebhookLeaseOutcomeUnknown(...args);
    },
    releaseForRetry: async (...args) => {
      const { releaseWebhookDeliveryForRetry } =
        await import("../db/queries/webhook-events.js");
      await releaseWebhookDeliveryForRetry(...args);
    },
    markFailed: async (...args) => {
      const { markWebhookFailed } =
        await import("../db/queries/webhook-events.js");
      await markWebhookFailed(...args);
    },
  });
}
