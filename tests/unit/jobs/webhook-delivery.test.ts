import { UnrecoverableError } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import {
  createWebhookDeliveryProcessor,
  enqueueWebhookDelivery,
  getWebhookJobId,
  RetryableWebhookPreDeliveryError,
} from "../../../src/jobs/webhook-delivery.js";

const telegramJob = (attemptsMade = 0) => ({
  data: {
    provider: "telegram" as const,
    providerEventId: "42",
    payload: { update_id: 42 },
  },
  attemptsMade,
  opts: { attempts: 5 },
});

function deliveryDependencies(overrides = {}) {
  return {
    processTelegram: vi.fn(async () => undefined),
    processWhatsApp: vi.fn(async () => undefined),
    acquireDelivery: vi.fn(async () => true),
    markProcessed: vi.fn(async () => undefined),
    markOutcomeUnknown: vi.fn(async () => undefined),
    markPendingLeaseOutcomeUnknown: vi.fn(async () => undefined),
    releaseForRetry: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("webhook delivery jobs", () => {
  it("builds deterministic BullMQ-safe job IDs", () => {
    const first = getWebhookJobId("whatsapp", "wamid:abc/123");
    const second = getWebhookJobId("whatsapp", "wamid:abc/123");

    expect(first).toBe(second);
    expect(first).toMatch(/^webhook-[a-f0-9]{64}$/);
    expect(first).not.toContain(":");
  });

  it("adds bounded retry, timeout, and retention settings", async () => {
    const add = vi.fn().mockResolvedValue({ id: "job-1" });

    await enqueueWebhookDelivery(
      { add },
      {
        provider: "telegram",
        providerEventId: "42",
        payload: { update_id: 42, message: { text: "hello" } },
      },
    );

    expect(add).toHaveBeenCalledWith(
      "webhook-delivery",
      expect.objectContaining({
        provider: "telegram",
        providerEventId: "42",
      }),
      expect.objectContaining({
        attempts: 5,
        backoff: { type: "exponential", delay: 1_000 },
        removeOnComplete: { age: 86_400, count: 10_000 },
        removeOnFail: { age: 604_800, count: 10_000 },
      }),
    );
  });

  it("marks success only after it holds the durable delivery lease", async () => {
    const order: string[] = [];
    const dependencies = deliveryDependencies({
      acquireDelivery: vi.fn(async () => {
        order.push("leased");
        return true;
      }),
      processTelegram: vi.fn(async () => {
        order.push("processed");
      }),
      markProcessed: vi.fn(async () => {
        order.push("marked");
      }),
    });
    const processor = createWebhookDeliveryProcessor(dependencies);

    await processor(telegramJob());

    expect(order).toEqual(["leased", "processed", "marked"]);
    expect(dependencies.acquireDelivery).toHaveBeenCalledWith(
      "telegram",
      "42",
      1,
      expect.any(String),
    );
    expect(dependencies.markProcessed).toHaveBeenCalledWith(
      "telegram",
      "42",
      expect.any(String),
    );
  });

  it("keeps safe pre-delivery persistence failures retryable", async () => {
    const dependencies = deliveryDependencies({
      acquireDelivery: vi.fn(async () => {
        throw new Error("database unavailable before provider invocation");
      }),
    });
    const processor = createWebhookDeliveryProcessor(dependencies);

    await expect(processor(telegramJob())).rejects.toThrow(
      "database unavailable before provider invocation",
    );
    expect(dependencies.processTelegram).not.toHaveBeenCalled();
    expect(dependencies.markOutcomeUnknown).not.toHaveBeenCalled();
  });

  it("flags a recovered pending lease for reconciliation without re-running it", async () => {
    const dependencies = deliveryDependencies({
      acquireDelivery: vi.fn(async () => false),
    });
    const processor = createWebhookDeliveryProcessor(dependencies);

    await processor(telegramJob(1));

    expect(dependencies.processTelegram).not.toHaveBeenCalled();
    expect(dependencies.markPendingLeaseOutcomeUnknown).toHaveBeenCalledWith(
      "telegram",
      "42",
    );
    expect(dependencies.markProcessed).not.toHaveBeenCalled();
  });

  it("releases only an explicit pre-delivery failure for a bounded retry", async () => {
    const dependencies = deliveryDependencies({
      processTelegram: vi.fn(async () => {
        throw new RetryableWebhookPreDeliveryError("bot initialization failed");
      }),
    });
    const processor = createWebhookDeliveryProcessor(dependencies);

    await expect(processor(telegramJob())).rejects.toBeInstanceOf(
      RetryableWebhookPreDeliveryError,
    );
    expect(dependencies.releaseForRetry).toHaveBeenCalledWith(
      "telegram",
      "42",
      1,
      expect.any(String),
    );
    expect(dependencies.markOutcomeUnknown).not.toHaveBeenCalled();
    expect(dependencies.markFailed).not.toHaveBeenCalled();
  });

  it("records a redacted terminal failed state for exhausted pre-delivery retries", async () => {
    const dependencies = deliveryDependencies({
      processTelegram: vi.fn(async () => {
        throw new RetryableWebhookPreDeliveryError("secret raw provider detail");
      }),
    });
    const processor = createWebhookDeliveryProcessor(dependencies);

    await expect(processor(telegramJob(4))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(dependencies.markFailed).toHaveBeenCalledWith(
      "telegram",
      "42",
      5,
      expect.any(String),
      "Webhook delivery failed before provider invocation",
    );
    expect(dependencies.releaseForRetry).not.toHaveBeenCalled();
    expect(dependencies.markOutcomeUnknown).not.toHaveBeenCalled();
  });

  it("does not repeat an opaque provider failure after it has acquired a lease", async () => {
    const dependencies = deliveryDependencies({
      processTelegram: vi.fn(async () => {
        throw new Error("provider may have completed after sending");
      }),
    });
    const processor = createWebhookDeliveryProcessor(dependencies);

    await expect(processor(telegramJob())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(dependencies.markOutcomeUnknown).toHaveBeenCalledWith(
      "telegram",
      "42",
      expect.any(String),
      "Webhook delivery outcome requires reconciliation",
    );

    dependencies.acquireDelivery.mockResolvedValueOnce(false);
    await processor(telegramJob(1));
    expect(dependencies.processTelegram).toHaveBeenCalledOnce();
  });

  it("does not repeat an external side effect when recording success fails", async () => {
    const dependencies = deliveryDependencies({
      markProcessed: vi.fn(async () => {
        throw new Error("database write lost after provider side effect");
      }),
    });
    const processor = createWebhookDeliveryProcessor(dependencies);

    await expect(processor(telegramJob())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(dependencies.markOutcomeUnknown).toHaveBeenCalledOnce();

    dependencies.acquireDelivery.mockResolvedValueOnce(false);
    await processor(telegramJob(1));
    expect(dependencies.processTelegram).toHaveBeenCalledOnce();
  });

  it("holds a timed-out delivery for reconciliation and records a later success without replaying", async () => {
    vi.useFakeTimers();
    let resolveDelivery: (() => void) | undefined;
    const dependencies = deliveryDependencies({
      processTelegram: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveDelivery = resolve;
          }),
      ),
    });
    const processor = createWebhookDeliveryProcessor(dependencies);

    try {
      const pending = processor(telegramJob());
      const rejection =
        expect(pending).rejects.toBeInstanceOf(UnrecoverableError);
      await vi.advanceTimersByTimeAsync(30_000);
      await rejection;
      expect(dependencies.markOutcomeUnknown).toHaveBeenCalledOnce();

      dependencies.acquireDelivery.mockResolvedValueOnce(false);
      await processor(telegramJob(1));
      expect(dependencies.processTelegram).toHaveBeenCalledOnce();

      resolveDelivery?.();
      await vi.runAllTicks();
      await Promise.resolve();
      expect(dependencies.markProcessed).toHaveBeenCalledWith(
        "telegram",
        "42",
        expect.any(String),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
