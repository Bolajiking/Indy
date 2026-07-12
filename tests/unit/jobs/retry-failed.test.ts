import { describe, expect, it, vi } from "vitest";
import {
  parseRetryFailedArgs,
  retryFailedJobs,
} from "../../../scripts/retry-failed-jobs.js";
import { RETRYABLE_WEBHOOK_FAILURE } from "../../../src/db/queries/webhook-events.js";

describe("failed job recovery", () => {
  it("parses dry-run, job filters, and a bounded maximum", () => {
    expect(
      parseRetryFailedArgs([
        "--dry-run",
        "--type",
        "account-deletion",
        "--max",
        "12",
      ]),
    ).toEqual({ dryRun: true, types: ["account-deletion"], max: 12 });
    expect(() => parseRetryFailedArgs(["--type", "morning-brief"])).toThrow();
    expect(() => parseRetryFailedArgs(["--max", "0"])).toThrow();
  });

  it("dry-runs only explicitly retryable job types without mutation", async () => {
    const jobs = [
      {
        name: "account-deletion",
        data: { creatorId: "creator-1" },
        retry: vi.fn(),
      },
      {
        name: "weekly-review",
        data: {},
        retry: vi.fn(),
      },
    ];
    const result = await retryFailedJobs(
      { getJobs: vi.fn().mockResolvedValue(jobs) },
      { dryRun: true, types: [], max: 10 },
    );
    expect(result).toEqual({ eligible: 1, retried: 0, skipped: 1 });
    expect(jobs[0].retry).not.toHaveBeenCalled();
  });

  it("replays safe pre-delivery webhooks but skips ambiguous outcomes", async () => {
    const safe = {
      name: "webhook-delivery",
      failedReason: RETRYABLE_WEBHOOK_FAILURE,
      data: { provider: "telegram", providerEventId: "update-1" },
      retry: vi.fn(),
    };
    const ambiguous = {
      name: "webhook-delivery",
      failedReason: "Webhook delivery outcome requires reconciliation",
      data: { provider: "telegram", providerEventId: "update-2" },
      retry: vi.fn(),
    };
    const prepareWebhook = vi.fn();
    const result = await retryFailedJobs(
      { getJobs: vi.fn().mockResolvedValue([safe, ambiguous]) },
      { dryRun: false, types: ["webhook-delivery"], max: 10 },
      { prepareAccount: vi.fn(), prepareWebhook },
    );
    expect(prepareWebhook).toHaveBeenCalledWith("telegram", "update-1");
    expect(safe.retry).toHaveBeenCalledOnce();
    expect(ambiguous.retry).not.toHaveBeenCalled();
    expect(result).toEqual({ eligible: 1, retried: 1, skipped: 1 });
  });
});
