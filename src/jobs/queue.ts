import type { ConnectionOptions } from "bullmq";
import { Queue, Worker } from "bullmq";
import pino from "pino";
import { env } from "../config/env.js";

const log = pino({ name: "jobs:queue" });

let connection: ConnectionOptions | null = null;
let agentQueue: Queue | null = null;

function getQueueConnection(): ConnectionOptions {
  if (!connection) {
    const redisUrl = new URL(env.REDIS_URL);

    connection = {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || "6379"),
      username: redisUrl.username || undefined,
      password: redisUrl.password || undefined,
      db: redisUrl.pathname ? Number(redisUrl.pathname.replace("/", "") || "0") : 0,
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
    });
  }

  return agentQueue;
}

export async function processJob(job: {
  name: string;
  data: { creatorId?: string };
}): Promise<void> {
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
      const { aggregateAnalytics } = await import("../agent/skills/analytics-aggregator.js");
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
    default:
      log.warn({ jobName: job.name }, "Unknown job type");
  }
}

export function startWorkers(): Worker {
  const worker = new Worker("indyfren-agent", processJob, {
    connection: getQueueConnection(),
    concurrency: 5,
  });

  worker.on("failed", (job, error) => {
    log.error({ jobId: job?.id, jobName: job?.name, error: error.message }, "Job failed");
  });

  worker.on("error", (error) => {
    log.error({ error: error.message }, "Worker error (Redis connection issue)");
  });

  log.info("Job workers started");
  return worker;
}

export async function scheduleRecurringJobs(
  queue: Pick<Queue, "add"> = getAgentQueue()
): Promise<void> {
  await queue.add("morning-scan", {}, {
    jobId: "morning-scan-all",
    repeat: { pattern: "0 6 * * *" },
    removeOnComplete: true,
  });

  await queue.add("morning-brief", {}, {
    jobId: "morning-brief-all",
    repeat: { pattern: "0 7 * * *" },
    removeOnComplete: true,
  });

  await queue.add("invoice-reminder", {}, {
    jobId: "invoice-reminder-all",
    repeat: { pattern: "0 10 * * 1" }, // Mondays at 10am
    removeOnComplete: true,
  });

  await queue.add("end-of-day-summary", {}, {
    jobId: "eod-summary-all",
    repeat: { pattern: "0 18 * * *" }, // Daily at 6pm
    removeOnComplete: true,
  });

  await queue.add("weekly-review", {}, {
    jobId: "weekly-review-all",
    repeat: { pattern: "0 10 * * 0" }, // Sundays at 10am
    removeOnComplete: true,
  });

  log.info("Recurring jobs scheduled");
}
