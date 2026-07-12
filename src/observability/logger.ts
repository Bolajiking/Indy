import pino, { type Logger, type LoggerOptions } from "pino";
import { getRequestId } from "./request-context.js";
import { redactSensitive } from "./redaction.js";

export type { Logger };

export default function createLogger(
  options: LoggerOptions | { name: string } = {},
): Logger {
  return pino({
    ...options,
    base: undefined,
    mixin: () => ({ ...(getRequestId() ? { requestId: getRequestId() } : {}) }),
    hooks: {
      logMethod(args, method) {
        method.apply(
          this,
          args.map((arg) => redactSensitive(arg)) as Parameters<typeof method>,
        );
      },
    },
  });
}
