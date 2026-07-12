import { pathToFileURL } from "node:url";
import { getAgentQueue } from "../src/jobs/queue.js";
import { updateAccountDeletion } from "../src/db/queries/account-lifecycle.js";
import {
  requeueRetryableWebhookFailure,
  RETRYABLE_WEBHOOK_FAILURE,
  type WebhookProvider,
} from "../src/db/queries/webhook-events.js";

const RETRYABLE_TYPES = new Set(["account-deletion", "webhook-delivery"]);

export interface RetryFailedOptions {
  dryRun: boolean;
  types: string[];
  max: number;
}

interface FailedJob {
  id?: string;
  name: string;
  data: Record<string, unknown>;
  failedReason?: string;
  retry(): Promise<void>;
}

interface FailedQueue {
  getJobs(types: ["failed"], start: number, end: number): Promise<FailedJob[]>;
  close?(): Promise<void>;
}

interface RetryDependencies {
  prepareAccount(creatorId: string): Promise<void>;
  prepareWebhook(
    provider: WebhookProvider,
    providerEventId: string,
  ): Promise<void>;
}

const defaultDependencies: RetryDependencies = {
  prepareAccount: async (creatorId) =>
    updateAccountDeletion(creatorId, "requested", { error: null }),
  prepareWebhook: requeueRetryableWebhookFailure,
};

export function parseRetryFailedArgs(args: string[]): RetryFailedOptions {
  const options: RetryFailedOptions = { dryRun: false, types: [], max: 100 };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--type") options.types.push(args[++index] ?? "");
    else if (arg === "--max") options.max = Number(args[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (
    !Number.isInteger(options.max) ||
    options.max < 1 ||
    options.max > 1_000
  ) {
    throw new Error("--max must be an integer from 1 to 1000");
  }
  if (options.types.some((type) => !RETRYABLE_TYPES.has(type))) {
    throw new Error("--type must be account-deletion or webhook-delivery");
  }
  return options;
}

export async function retryFailedJobs(
  queue: FailedQueue,
  options: RetryFailedOptions,
  dependencies: RetryDependencies = defaultDependencies,
): Promise<{ eligible: number; retried: number; skipped: number }> {
  const jobs = await queue.getJobs(["failed"], 0, options.max - 1);
  let eligible = 0;
  let retried = 0;
  let skipped = 0;
  for (const job of jobs) {
    if (
      !RETRYABLE_TYPES.has(job.name) ||
      (options.types.length > 0 && !options.types.includes(job.name))
    ) {
      skipped += 1;
      continue;
    }
    if (
      job.name === "webhook-delivery" &&
      job.failedReason !== RETRYABLE_WEBHOOK_FAILURE
    ) {
      skipped += 1;
      continue;
    }
    eligible += 1;
    if (options.dryRun) continue;
    if (job.name === "account-deletion") {
      if (typeof job.data.creatorId !== "string") {
        skipped += 1;
        eligible -= 1;
        continue;
      }
      await dependencies.prepareAccount(job.data.creatorId);
    } else {
      if (
        (job.data.provider !== "telegram" &&
          job.data.provider !== "whatsapp") ||
        typeof job.data.providerEventId !== "string"
      ) {
        skipped += 1;
        eligible -= 1;
        continue;
      }
      await dependencies.prepareWebhook(
        job.data.provider,
        job.data.providerEventId,
      );
    }
    await job.retry();
    retried += 1;
  }
  return { eligible, retried, skipped };
}

async function main() {
  const options = parseRetryFailedArgs(process.argv.slice(2));
  const queue = getAgentQueue();
  try {
    const result = await retryFailedJobs(
      queue as unknown as FailedQueue,
      options,
    );
    process.stdout.write(`${JSON.stringify({ ...options, ...result })}\n`);
  } finally {
    await queue.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Retry failed"}\n`,
    );
    process.exitCode = 1;
  });
}
