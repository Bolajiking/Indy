import type { ConnectionOptions, JobsOptions } from "bullmq";
import { Queue, Worker } from "bullmq";
import type { Bot } from "grammy";
import pino from "#logger";
import { env } from "../config/env.js";
import { incrementMetric, setMetric } from "../observability/metrics.js";
import {
  resolveRequestId,
  runWithRequestId,
} from "../observability/request-context.js";

const log = pino({ name: "jobs:queue" });

let connection: ConnectionOptions | null = null;
let agentQueue: Queue | null = null;
let agentWorker: Worker | null = null;

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { age: 86_400, count: 5_000 },
  removeOnFail: { age: 604_800, count: 5_000 },
};

export const WORKER_CONCURRENCY = 5;

function getQueueConnection(): ConnectionOptions {
  if (!connection) {
    const redisUrl = new URL(env.REDIS_URL);

    connection = {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || "6379"),
      username: redisUrl.username || undefined,
      password: redisUrl.password || undefined,
      db: redisUrl.pathname
        ? Number(redisUrl.pathname.replace("/", "") || "0")
        : 0,
      maxRetriesPerRequest: null,
      tls: redisUrl.protocol === "rediss:" ? {} : undefined,
    };
  }

  return connection;
}

export function getAgentQueue(): Queue {
  if (!agentQueue) {
    agentQueue = new Queue("indyfren-agent", {
      connection: getQueueConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  return agentQueue;
}

export async function processJob(job: {
  name: string;
  data: { creatorId?: string; requestId?: string };
}): Promise<void> {
  incrementMetric("queue_jobs_started_total", { job: job.name });
  switch (job.name) {
    case "morning-scan": {
      const { runMorningScan } = await import("./morning-scan.js");
      await runMorningScan(job.data.creatorId);
      return;
    }
    case "morning-brief": {
      const { runMorningBrief } = await import("./morning-brief.js");
      await runMorningBrief(job.data.creatorId);
      return;
    }
    case "invoice-reminder": {
      const { runInvoiceReminder } = await import("./invoice-reminder.js");
      await runInvoiceReminder(job.data.creatorId);
      return;
    }
    case "end-of-day-summary": {
      const { runEndOfDaySummary } = await import("./end-of-day-summary.js");
      await runEndOfDaySummary(job.data.creatorId);
      return;
    }
    case "analytics-aggregation": {
      const { aggregateAnalytics } =
        await import("../agent/skills/analytics-aggregator.js");
      if (job.data.creatorId) {
        await aggregateAnalytics(job.data.creatorId);
      }
      return;
    }
    case "weekly-review": {
      const { runWeeklyReview } = await import("./weekly-review.js");
      await runWeeklyReview(job.data.creatorId);
      return;
    }
    case "account-deletion": {
      const { createAccountDeletionProcessor } =
        await import("./account-deletion.js");
      await createAccountDeletionProcessor()(
        job as { data: { creatorId: string } },
      );
      return;
    }
    default:
      log.warn({ jobName: job.name }, "Unknown job type");
  }
}

export function startWorkers(
  options: { telegramBot?: Bot | null } = {},
): Worker {
  if (agentWorker) return agentWorker;

  const worker = new Worker(
    "indyfren-agent",
    async (job) => {
      await runWithRequestId(
        resolveRequestId(
          typeof job.data?.requestId === "string"
            ? job.data.requestId
            : undefined,
        ),
        async () => {
          if (job.name === "webhook-delivery") {
            const { createDefaultWebhookDeliveryProcessor } =
              await import("./webhook-delivery.js");
            const processor = createDefaultWebhookDeliveryProcessor(
              options.telegramBot ?? null,
            );
            await processor(job as never);
            return;
          }
          await processJob(job);
        },
      );
    },
    {
      connection: getQueueConnection(),
      concurrency: WORKER_CONCURRENCY,
      // Reclaim work after a crashed worker while allowing long provider calls
      // enough time to renew their lock.
      lockDuration: 120_000,
    },
  );

  worker.on("failed", (job, error) => {
    incrementMetric("queue_job_failures_total", {
      job: job?.name ?? "unknown",
    });
    log.error(
      {
        jobId: job?.id,
        jobName: job?.name,
        error:
          job?.name === "webhook-delivery"
            ? "Webhook delivery failed"
            : error.message,
      },
      "Job failed",
    );
  });

  const recordDepth = async () => {
    const counts = await getAgentQueue().getJobCounts(
      "waiting",
      "active",
      "delayed",
      "failed",
    );
    for (const [state, count] of Object.entries(counts)) {
      setMetric("queue_depth", count, { state });
    }
  };
  worker.on("completed", () => void recordDepth().catch(() => undefined));
  worker.on("failed", () => void recordDepth().catch(() => undefined));

  worker.on("error", (error) => {
    incrementMetric("queue_worker_errors_total");
    log.error(
      { error: error.message },
      "Worker error (Redis connection issue)",
    );
  });

  log.info("Job workers started");
  agentWorker = worker;
  return agentWorker;
}

export async function checkQueueReadiness(): Promise<void> {
  await getAgentQueue().waitUntilReady();
  if (env.ENABLE_JOBS) {
    if (!agentWorker) throw new Error("Queue worker is not running");
    await agentWorker.waitUntilReady();
  }
}

export async function closeQueueResources(): Promise<void> {
  const worker = agentWorker;
  const queue = agentQueue;
  // Stop consumption before closing the producer connection. Worker.close()
  // waits for active jobs, bounded by the runtime shutdown deadline.
  try {
    if (worker) await worker.close();
  } finally {
    try {
      if (queue) await queue.close();
    } finally {
      agentWorker = null;
      agentQueue = null;
      connection = null;
    }
  }
}

export async function scheduleRecurringJobs(
  queue: Pick<Queue, "add"> = getAgentQueue(),
): Promise<void> {
  await queue.add(
    "morning-scan",
    {},
    {
      jobId: "morning-scan-all",
      repeat: { pattern: "0 6 * * *" },
      removeOnComplete: DEFAULT_JOB_OPTIONS.removeOnComplete,
    },
  );

  await queue.add(
    "morning-brief",
    {},
    {
      jobId: "morning-brief-all",
      repeat: { pattern: "0 7 * * *" },
      removeOnComplete: DEFAULT_JOB_OPTIONS.removeOnComplete,
    },
  );

  await queue.add(
    "invoice-reminder",
    {},
    {
      jobId: "invoice-reminder-all",
      repeat: { pattern: "0 10 * * 1" }, // Mondays at 10am
      removeOnComplete: DEFAULT_JOB_OPTIONS.removeOnComplete,
    },
  );

  await queue.add(
    "end-of-day-summary",
    {},
    {
      jobId: "eod-summary-all",
      repeat: { pattern: "0 18 * * *" }, // Daily at 6pm
      removeOnComplete: DEFAULT_JOB_OPTIONS.removeOnComplete,
    },
  );

  await queue.add(
    "weekly-review",
    {},
    {
      jobId: "weekly-review-all",
      repeat: { pattern: "0 10 * * 0" }, // Sundays at 10am
      removeOnComplete: DEFAULT_JOB_OPTIONS.removeOnComplete,
    },
  );

  log.info("Recurring jobs scheduled");
}
