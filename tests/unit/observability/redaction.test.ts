import { describe, expect, it } from "vitest";
import { redactSensitive } from "../../../src/observability/redaction.js";

describe("observability redaction", () => {
  it("redacts nested credentials, OAuth codes, personal text, and error causes", () => {
    const value = redactSensitive({
      authorization: "Bearer top-secret",
      privy_app_secret: "privy-secret",
      supabase_service_key: "service-secret",
      provider_token: "provider-secret",
      code: "oauth-code",
      email: "creator@example.com",
      body: { message: { text: "private creator message" } },
      error: Object.assign(new Error("failed with token=raw"), {
        cause: { refresh_token: "refresh-secret" },
      }),
    });
    const text = JSON.stringify(value);
    for (const secret of [
      "top-secret",
      "privy-secret",
      "service-secret",
      "provider-secret",
      "oauth-code",
      "creator@example.com",
      "private creator message",
      "refresh-secret",
      "token=raw",
    ]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain("[REDACTED]");
  });
});
