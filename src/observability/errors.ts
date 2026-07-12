import { redactSensitive } from "./redaction.js";

export interface PublicErrorEnvelope {
  error: { code: string; message: string; requestId: string };
}

export interface ErrorReportContext {
  requestId?: string;
  component: string;
  operation?: string;
  tags?: Record<string, string>;
}

export interface ErrorReporter {
  capture(error: unknown, context: ErrorReportContext): void | Promise<void>;
}

let reporter: ErrorReporter | null = null;

/** Configure Sentry/OTel/etc. at composition root; null keeps local runs inert. */
export function configureErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

export function reportError(error: unknown, context: ErrorReportContext): void {
  if (!reporter) return;
  Promise.resolve(reporter.capture(redactSensitive(error), context)).catch(
    () => undefined,
  );
}

export function publicError(
  code: string,
  message: string,
  requestId: string,
): PublicErrorEnvelope {
  return { error: { code, message, requestId } };
}
