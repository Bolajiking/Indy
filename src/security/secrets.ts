import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTED_PREFIX = "v1";
const TEST_FALLBACK_KEY = "indyfren-test-platform-secret-key";

export function isEncryptedSecretValue(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith(`${ENCRYPTED_PREFIX}:`));
}

function getKeyMaterial(): string {
  const appSecret = process.env.PRIVY_APP_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (appSecret && serviceKey) {
    return `${serviceKey}:${appSecret}`;
  }

  if (process.env.NODE_ENV === "test") {
    return TEST_FALLBACK_KEY;
  }

  throw new Error("Platform secret encryption is not configured");
}

function getEncryptionKey(): Buffer {
  return createHash("sha256").update(getKeyMaterial()).digest();
}

export function encryptSecretValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (isEncryptedSecretValue(value)) {
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecretValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (!isEncryptedSecretValue(value)) {
    return value;
  }

  const [, ivRaw, tagRaw, encryptedRaw] = value.split(":");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted secret format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
