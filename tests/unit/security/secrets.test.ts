import { createCipheriv, createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  decryptSecretValue,
  encryptSecretValue,
  getCurrentPlatformKeyVersion,
} from "../../../src/security/secrets.js";

const currentKey = Buffer.alloc(32, 7).toString("base64");
const previousKey = Buffer.alloc(32, 3).toString("base64");

function legacyV1(value: string): string {
  const iv = Buffer.alloc(12, 1);
  const key = createHash("sha256")
    .update("service-secret:privy-secret")
    .digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

describe("versioned platform secrets", () => {
  beforeEach(() => {
    process.env.PLATFORM_ENCRYPTION_KEY_VERSION = "2";
    process.env.PLATFORM_ENCRYPTION_KEY_CURRENT = currentKey;
    process.env.PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION = "1";
    process.env.PLATFORM_ENCRYPTION_KEY_PREVIOUS = previousKey;
    process.env.SUPABASE_SERVICE_KEY = "service-secret";
    process.env.PRIVY_APP_SECRET = "privy-secret";
  });

  afterEach(() => {
    delete process.env.PLATFORM_ENCRYPTION_KEY_VERSION;
    delete process.env.PLATFORM_ENCRYPTION_KEY_CURRENT;
    delete process.env.PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION;
    delete process.env.PLATFORM_ENCRYPTION_KEY_PREVIOUS;
  });

  it("encrypts new values with the configured current key version", () => {
    const encrypted = encryptSecretValue("token");
    expect(encrypted).toMatch(/^v2:2:/);
    expect(encrypted).not.toContain("token");
    expect(decryptSecretValue(encrypted)).toBe("token");
    expect(getCurrentPlatformKeyVersion()).toBe(2);
  });

  it("decrypts values written with the configured previous version", () => {
    process.env.PLATFORM_ENCRYPTION_KEY_VERSION = "1";
    process.env.PLATFORM_ENCRYPTION_KEY_CURRENT = previousKey;
    delete process.env.PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION;
    delete process.env.PLATFORM_ENCRYPTION_KEY_PREVIOUS;
    const encrypted = encryptSecretValue("old-token");

    process.env.PLATFORM_ENCRYPTION_KEY_VERSION = "2";
    process.env.PLATFORM_ENCRYPTION_KEY_CURRENT = currentKey;
    process.env.PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION = "1";
    process.env.PLATFORM_ENCRYPTION_KEY_PREVIOUS = previousKey;
    expect(decryptSecretValue(encrypted)).toBe("old-token");
  });

  it("rejects unknown versions and malformed ciphertext without returning plaintext", () => {
    expect(() => decryptSecretValue("v2:99:abc:def:ghi")).toThrow(
      /unavailable key version/,
    );
    expect(() => decryptSecretValue("v2:2:not-base64:bad:bad")).toThrow(
      /Invalid encrypted secret/,
    );
  });

  it("reads legacy v1 envelopes but never writes them", () => {
    expect(decryptSecretValue(legacyV1("legacy-token"))).toBe("legacy-token");
    expect(encryptSecretValue("new-token")).toMatch(/^v2:/);
  });

  it("requires exactly 32 bytes of base64 key material", () => {
    process.env.PLATFORM_ENCRYPTION_KEY_CURRENT =
      Buffer.alloc(31).toString("base64");
    expect(() => encryptSecretValue("token")).toThrow(/32-byte base64/);
  });
});
