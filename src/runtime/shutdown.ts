export interface RuntimeResource {
  name: string;
  close: () => void | Promise<void>;
}

export interface ShutdownOptions {
  timeoutMs?: number;
  onTimeout?: (pending: string[]) => void;
}

export class RuntimeLifecycle {
  private readonly resources: RuntimeResource[] = [];
  private shutdownPromise: Promise<void> | null = null;
  private accepting = true;

  get isShuttingDown(): boolean {
    return !this.accepting;
  }

  register(resource: RuntimeResource): () => void {
    if (!this.accepting) throw new Error("Runtime is shutting down");
    this.resources.push(resource);
    return () => {
      const index = this.resources.indexOf(resource);
      if (index >= 0) this.resources.splice(index, 1);
    };
  }

  shutdown(options: ShutdownOptions = {}): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;
    this.accepting = false;
    const timeoutMs = options.timeoutMs ?? 30_000;
    const resources = [...this.resources];
    const pending = new Set(resources.map((resource) => resource.name));

    const closeAll = (async () => {
      const failures: unknown[] = [];
      for (const resource of resources) {
        try {
          await resource.close();
        } catch (error) {
          failures.push(error);
        } finally {
          pending.delete(resource.name);
        }
      }
      if (failures.length > 0)
        throw new AggregateError(failures, "Runtime resources failed to close");
    })();

    this.shutdownPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        options.onTimeout?.([...pending]);
        resolve();
      }, timeoutMs);
      timeout.unref?.();
      closeAll.then(
        () => {
          clearTimeout(timeout);
          resolve();
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      );
    });
    return this.shutdownPromise;
  }
}

export function createSignalShutdownHandler(options: {
  lifecycle: RuntimeLifecycle;
  timeoutMs?: number;
  exit?: (code: number) => void;
  onError?: (error: unknown) => void;
  onTimeout?: (pending: string[]) => void;
}): (signal: NodeJS.Signals) => void {
  let handled = false;
  return () => {
    if (handled) return;
    handled = true;
    void options.lifecycle
      .shutdown({ timeoutMs: options.timeoutMs, onTimeout: options.onTimeout })
      .then(() => (options.exit ?? process.exit)(0))
      .catch((error) => {
        options.onError?.(error);
        (options.exit ?? process.exit)(1);
      });
  };
}
