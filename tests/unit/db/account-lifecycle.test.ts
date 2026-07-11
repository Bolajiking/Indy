import { describe, expect, it } from "vitest";
import {
  hashDeletionToken,
  isDeletionTokenExpired,
  redactExportSecrets,
} from "../../../src/db/queries/account-lifecycle.js";

describe("account lifecycle privacy primitives", () => {
  it("stores deterministic token hashes rather than raw receipt tokens", () => {
    const raw = "opaque-deletion-receipt";
    expect(hashDeletionToken(raw)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashDeletionToken(raw)).not.toContain(raw);
    expect(hashDeletionToken(raw)).not.toBe(hashDeletionToken("other-user"));
  });

  it("rejects expired and malformed receipt expiries", () => {
    expect(
      isDeletionTokenExpired(
        "2026-07-11T00:00:00.000Z",
        Date.parse("2026-07-11T00:00:01.000Z"),
      ),
    ).toBe(true);
    expect(
      isDeletionTokenExpired(
        "2026-07-12T00:00:00.000Z",
        Date.parse("2026-07-11T00:00:01.000Z"),
      ),
    ).toBe(false);
    expect(isDeletionTokenExpired("invalid")).toBe(true);
  });

  it("recursively removes nested secrets across exported sections", () => {
    const redacted = redactExportSecrets({
      actions: [
        {
          input: {
            access_token: "secret",
            nested: { private_key: "key", safe: "yes" },
          },
        },
      ],
      messages: [
        {
          metadata: {
            authorization: "Bearer raw",
            cookie: "raw",
            subject: "safe",
          },
        },
      ],
      payments: [{ wallet_id: "wallet-secret", receipt: "public" }],
    });
    const text = JSON.stringify(redacted);
    expect(text).not.toMatch(
      /secret|private_key|authorization|cookie|wallet_id|Bearer raw/,
    );
    expect(text).toContain("safe");
    expect(text).toContain("receipt");
  });
});
