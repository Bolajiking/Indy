import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const storage = new AsyncLocalStorage<{ requestId: string }>();
const VALID_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function resolveRequestId(value?: string | null): string {
  return value && VALID_REQUEST_ID.test(value) ? value : randomUUID();
}

export function runWithRequestId<T>(requestId: string, callback: () => T): T {
  return storage.run({ requestId }, callback);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
