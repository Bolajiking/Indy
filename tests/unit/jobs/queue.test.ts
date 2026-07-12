import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  queueAdd,
  queueClose,
  workerOn,
  workerInstance,
  queueConstructor,
  workerConstructor,
} = vi.hoisted(() => {
  const queueAdd = vi.fn();
  const queueClose = vi.fn();
  const workerOn = vi.fn();
  const workerInstance = {
    on: workerOn,
    close: vi.fn(),
    waitUntilReady: vi.fn(),
  };
  const queueConstructor = vi.fn(function QueueMock() {
    return {
      add: queueAdd,
      close: queueClose,
      waitUntilReady: vi.fn(),
      getJobCounts: vi.fn().mockResolvedValue({}),
    };
  });
  const workerConstructor = vi.fn(function WorkerMock() {
    return workerInstance;
  });

  return {
    queueAdd,
    queueClose,
    workerOn,
    workerInstance,
    queueConstructor,
    workerConstructor,
  };
});

vi.mock("bullmq", () => ({
  Queue: queueConstructor,
  Worker: workerConstructor,
}));

vi.mock("../../../src/jobs/morning-scan.js", () => ({
  runMorningScan: vi.fn(),
}));

vi.mock("../../../src/jobs/morning-brief.js", () => ({
  runMorningBrief: vi.fn(),
}));

import { runMorningBrief } from "../../../src/jobs/morning-brief.js";
import { runMorningScan } from "../../../src/jobs/morning-scan.js";
import {
  closeQueueResources,
  getAgentQueue,
  DEFAULT_JOB_OPTIONS,
  processJob,
  scheduleRecurringJobs,
  startWorkers,
} from "../../../src/jobs/queue.js";

describe("jobs queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("schedules recurring morning scan and brief jobs", async () => {
    const queue = getAgentQueue();

    expect(queueConstructor).toHaveBeenCalledWith(
      "indyfren-agent",
      expect.objectContaining({ defaultJobOptions: DEFAULT_JOB_OPTIONS }),
    );

    await scheduleRecurringJobs(queue);

    expect(queueAdd).toHaveBeenCalledTimes(5);
    expect(queueAdd).toHaveBeenNthCalledWith(
      1,
      "morning-scan",
      {},
      expect.objectContaining({
        jobId: "morning-scan-all",
        removeOnComplete: { age: 86_400, count: 5_000 },
        repeat: { pattern: "0 6 * * *" },
      }),
    );
    expect(queueAdd).toHaveBeenNthCalledWith(
      2,
      "morning-brief",
      {},
      expect.objectContaining({
        jobId: "morning-brief-all",
        removeOnComplete: { age: 86_400, count: 5_000 },
        repeat: { pattern: "0 7 * * *" },
      }),
    );
  });

  it("dispatches known jobs to their handlers", async () => {
    await processJob({
      name: "morning-scan",
      data: { creatorId: "creator-1" },
    });
    await processJob({
      name: "morning-brief",
      data: { creatorId: "creator-2" },
    });

    expect(runMorningScan).toHaveBeenCalledWith("creator-1");
    expect(runMorningBrief).toHaveBeenCalledWith("creator-2");
  });

  it("starts a BullMQ worker for the agent queue", () => {
    const worker = startWorkers();

    expect(worker).toBe(workerInstance);
    expect(startWorkers()).toBe(workerInstance);
    expect(workerConstructor).toHaveBeenCalledOnce();
    expect(workerConstructor).toHaveBeenCalledWith(
      "indyfren-agent",
      expect.any(Function),
      expect.objectContaining({ concurrency: 5 }),
    );
    expect(workerOn).toHaveBeenCalledWith("failed", expect.any(Function));
  });

  it("configures bounded retention and retries on the queue", () => {
    expect(DEFAULT_JOB_OPTIONS).toMatchObject({
      attempts: 3,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: { age: 86_400, count: 5_000 },
      removeOnFail: { age: 604_800, count: 5_000 },
    });
  });

  it("closes the worker before the queue connection", async () => {
    const order: string[] = [];
    workerInstance.close.mockImplementation(
      async () => void order.push("worker"),
    );
    queueClose.mockImplementation(async () => void order.push("queue"));
    await closeQueueResources();
    expect(order).toEqual(["worker", "queue"]);
  });
});
