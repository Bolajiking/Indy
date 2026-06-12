import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  queueAdd,
  workerOn,
  workerInstance,
  queueConstructor,
  workerConstructor,
} = vi.hoisted(() => {
  const queueAdd = vi.fn();
  const workerOn = vi.fn();
  const workerInstance = { on: workerOn };
  const queueConstructor = vi.fn(function QueueMock() {
    return { add: queueAdd };
  });
  const workerConstructor = vi.fn(function WorkerMock() {
    return workerInstance;
  });

  return {
    queueAdd,
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
  getAgentQueue,
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

    await scheduleRecurringJobs(queue);

    expect(queueAdd).toHaveBeenCalledTimes(5);
    expect(queueAdd).toHaveBeenNthCalledWith(
      1,
      "morning-scan",
      {},
      expect.objectContaining({
        jobId: "morning-scan-all",
        removeOnComplete: true,
        repeat: { pattern: "0 6 * * *" },
      }),
    );
    expect(queueAdd).toHaveBeenNthCalledWith(
      2,
      "morning-brief",
      {},
      expect.objectContaining({
        jobId: "morning-brief-all",
        removeOnComplete: true,
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
    expect(workerConstructor).toHaveBeenCalledWith(
      "indyfren-agent",
      expect.any(Function),
      expect.objectContaining({ concurrency: 5 }),
    );
    expect(workerOn).toHaveBeenCalledWith("failed", expect.any(Function));
  });
});
