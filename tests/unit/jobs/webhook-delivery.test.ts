import { describe, expect, it, vi } from "vitest";
import {
  createWebhookDeliveryProcessor,
  enqueueWebhookDelivery,
  getWebhookJobId,
} from "../../../src/jobs/webhook-delivery.js";

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

  it("marks success only after provider processing completes", async () => {
    const order: string[] = [];
    const processTelegram = vi.fn(async () => {
      order.push("processed");
    });
    const markAttempt = vi.fn(async () => undefined);
    const markProcessed = vi.fn(async () => {
      order.push("marked");
    });
    const processor = createWebhookDeliveryProcessor({
      processTelegram,
      processWhatsApp: vi.fn(),
      markAttempt,
      markProcessed,
      markFailed: vi.fn(),
    });

    await processor({
      data: {
        provider: "telegram",
        providerEventId: "42",
        payload: { update_id: 42 },
      },
      attemptsMade: 0,
      opts: { attempts: 5 },
    });

    expect(order).toEqual(["processed", "marked"]);
    expect(markAttempt).toHaveBeenCalledWith("telegram", "42", 1);
  });

  it("keeps intermediate failures retryable and persists only terminal redacted errors", async () => {
    const markFailed = vi.fn(async () => undefined);
    const processor = createWebhookDeliveryProcessor({
      processTelegram: vi.fn(async () => {
        throw new Error("secret raw message content");
      }),
      processWhatsApp: vi.fn(),
      markAttempt: vi.fn(async () => undefined),
      markProcessed: vi.fn(async () => undefined),
      markFailed,
    });
    const job = {
      data: {
        provider: "telegram" as const,
        providerEventId: "42",
        payload: { update_id: 42 },
      },
      attemptsMade: 3,
      opts: { attempts: 5 },
    };

    await expect(processor(job)).rejects.toThrow("secret raw message content");
    expect(markFailed).not.toHaveBeenCalled();

    await expect(processor({ ...job, attemptsMade: 4 })).rejects.toThrow(
      "secret raw message content",
    );
    expect(markFailed).toHaveBeenCalledWith(
      "telegram",
      "42",
      5,
      "Webhook delivery failed",
    );
  });

  it("bounds a delivery attempt with a terminal timeout", async () => {
    vi.useFakeTimers();
    const markFailed = vi.fn(async () => undefined);
    const processor = createWebhookDeliveryProcessor({
      processTelegram: vi.fn(() => new Promise<void>(() => undefined)),
      processWhatsApp: vi.fn(),
      markAttempt: vi.fn(async () => undefined),
      markProcessed: vi.fn(async () => undefined),
      markFailed,
    });

    try {
      const pending = processor({
        data: {
          provider: "telegram",
          providerEventId: "timeout-event",
          payload: { update_id: 101 },
        },
        attemptsMade: 4,
        opts: { attempts: 5 },
      });
      const rejection = expect(pending).rejects.toThrow(
        "Webhook delivery timed out",
      );
      await vi.advanceTimersByTimeAsync(30_000);

      await rejection;
      expect(markFailed).toHaveBeenCalledWith(
        "telegram",
        "timeout-event",
        5,
        "Webhook delivery failed",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
