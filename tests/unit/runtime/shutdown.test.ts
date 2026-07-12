import { describe, expect, it, vi } from "vitest";
import {
  createSignalShutdownHandler,
  RuntimeLifecycle,
} from "../../../src/runtime/shutdown.js";

describe("runtime shutdown", () => {
  it("closes resources in registration order and is idempotent", async () => {
    const lifecycle = new RuntimeLifecycle();
    const closed: string[] = [];
    lifecycle.register({ name: "http", close: () => void closed.push("http") });
    lifecycle.register({
      name: "telegram",
      close: () => void closed.push("telegram"),
    });
    lifecycle.register({
      name: "workers",
      close: () => void closed.push("workers"),
    });

    const first = lifecycle.shutdown();
    const second = lifecycle.shutdown();
    expect(second).toBe(first);
    await first;

    expect(closed).toEqual(["http", "telegram", "workers"]);
    expect(lifecycle.isShuttingDown).toBe(true);
  });

  it("stops waiting at the deadline and reports pending resources", async () => {
    vi.useFakeTimers();
    const lifecycle = new RuntimeLifecycle();
    lifecycle.register({
      name: "stuck-worker",
      close: () => new Promise(() => undefined),
    });
    const onTimeout = vi.fn();
    const shutdown = lifecycle.shutdown({ timeoutMs: 50, onTimeout });
    await vi.advanceTimersByTimeAsync(50);
    await shutdown;
    expect(onTimeout).toHaveBeenCalledWith(["stuck-worker"]);
    vi.useRealTimers();
  });

  it("turns signals into one successful process exit", async () => {
    const lifecycle = new RuntimeLifecycle();
    const close = vi.fn();
    const exit = vi.fn();
    lifecycle.register({ name: "http", close });
    const handler = createSignalShutdownHandler({ lifecycle, exit });
    handler("SIGTERM");
    handler("SIGINT");
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());
    expect(close).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("attempts every close even when an earlier resource fails", async () => {
    const lifecycle = new RuntimeLifecycle();
    const laterClose = vi.fn();
    lifecycle.register({
      name: "broken",
      close: () => Promise.reject(new Error("close failed")),
    });
    lifecycle.register({ name: "later", close: laterClose });
    await expect(lifecycle.shutdown()).rejects.toThrow(
      "Runtime resources failed to close",
    );
    expect(laterClose).toHaveBeenCalledOnce();
  });
});
