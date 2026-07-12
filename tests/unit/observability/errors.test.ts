import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureErrorReporter,
  reportError,
} from "../../../src/observability/errors.js";

afterEach(() => configureErrorReporter(null));

describe("vendor-neutral error reporting", () => {
  it("is disabled safely by default", () => {
    expect(() =>
      reportError(new Error("local"), { component: "test" }),
    ).not.toThrow();
  });

  it("forwards errors and bounded context to an injected reporter", async () => {
    const capture = vi.fn();
    configureErrorReporter({ capture });
    const error = new Error("provider failed");
    reportError(error, {
      component: "api",
      operation: "GET /health",
      requestId: "req-1",
    });
    await Promise.resolve();
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Error",
        message: "[REDACTED]",
      }),
      {
        component: "api",
        operation: "GET /health",
        requestId: "req-1",
      },
    );
  });
});
