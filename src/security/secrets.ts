import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const TEST_KEY = createHash("sha256")
  .update("indyfren-test-platform-secret-key")
  .digest();
const VERSIONED_PREFIX = "v2";
const VERSION_PREFIX_PATTERN = /^v\d+:/;

interface PlatformKeyring {
  currentVersion: number;
  keys: Map<number, Buffer>;
}

export function isEncryptedSecretValue(
  value: string | null | undefined,
): boolean {
  return Boolean(value && VERSION_PREFIX_PATTERN.test(value));
}

function parseVersion(raw: string | undefined, field: string): number {
  if (!raw && process.env.NODE_ENV === "test") return 2;
  if (!raw || !/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${field} must be a positive integer`);
  }
  const version = Number(raw);
  if (!Number.isSafeInteger(version)) {
    throw new Error(`${field} must be a positive safe integer`);
  }
  return version;
}

function parseKey(raw: string | undefined, field: string): Buffer {
  if (!raw && process.env.NODE_ENV === "test") return TEST_KEY;
  if (!raw || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) {
    throw new Error(`${field} must be a canonical 32-byte base64 key`);
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw) {
    throw new Error(`${field} must be a canonical 32-byte base64 key`);
  }
  return key;
}

function getKeyring(): PlatformKeyring {
  const currentVersion = parseVersion(
    process.env.PLATFORM_ENCRYPTION_KEY_VERSION,
    "PLATFORM_ENCRYPTION_KEY_VERSION",
  );
  const keys = new Map<number, Buffer>([
    [
      currentVersion,
      parseKey(
        process.env.PLATFORM_ENCRYPTION_KEY_CURRENT,
        "PLATFORM_ENCRYPTION_KEY_CURRENT",
      ),
    ],
  ]);
  const previousVersionRaw =
    process.env.PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION;
  const previousKeyRaw = process.env.PLATFORM_ENCRYPTION_KEY_PREVIOUS;
  if (Boolean(previousVersionRaw) !== Boolean(previousKeyRaw)) {
    throw new Error(
      "PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION and PLATFORM_ENCRYPTION_KEY_PREVIOUS must be configured together",
    );
  }
  if (previousVersionRaw && previousKeyRaw) {
    const previousVersion = parseVersion(
      previousVersionRaw,
      "PLATFORM_ENCRYPTION_KEY_PREVIOUS_VERSION",
    );
    if (previousVersion === currentVersion) {
      throw new Error("Previous platform key version must differ from current");
    }
    keys.set(
      previousVersion,
      parseKey(previousKeyRaw, "PLATFORM_ENCRYPTION_KEY_PREVIOUS"),
    );
  }
  return { currentVersion, keys };
}

export function getCurrentPlatformKeyVersion(): number {
  return getKeyring().currentVersion;
}

export function getEncryptedSecretKeyVersion(
  value: string | null | undefined,
): number | null {
  if (!value || !isEncryptedSecretValue(value)) return null;
  if (value.startsWith("v1:")) return 1;
  const match = /^v2:([1-9]\d*):/.exec(value);
  if (!match) throw new Error("Invalid encrypted secret");
  return Number(match[1]);
}

function decryptLegacyV1(value: string): string {
  const [, ivRaw, tagRaw, encryptedRaw, ...extra] = value.split(":");
  if (!ivRaw || !tagRaw || !encryptedRaw || extra.length > 0) {
    throw new Error("Invalid encrypted secret");
  }
  const appSecret = process.env.PRIVY_APP_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!appSecret || !serviceKey) {
    throw new Error("Legacy platform secret key material is unavailable");
  }
  const key = createHash("sha256")
    .update(`${serviceKey}:${appSecret}`)
    .digest();
  return decryptAesGcm(ivRaw, tagRaw, encryptedRaw, key);
}

function decodeBase64Url(raw: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(raw))
    throw new Error("Invalid encrypted secret");
  const decoded = Buffer.from(raw, "base64url");
  if (decoded.length === 0 || decoded.toString("base64url") !== raw) {
    throw new Error("Invalid encrypted secret");
  }
  return decoded;
}

function decryptAesGcm(
  ivRaw: string,
  tagRaw: string,
  encryptedRaw: string,
  key: Buffer,
): string {
  try {
    const iv = decodeBase64Url(ivRaw);
    const tag = decodeBase64Url(tagRaw);
    const encrypted = decodeBase64Url(encryptedRaw);
    if (iv.length !== 12 || tag.length !== 16) {
      throw new Error("Invalid encrypted secret");
    }
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Invalid encrypted secret");
  }
}

export function encryptSecretValue(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const keyring = getKeyring();
  if (value.startsWith(`${VERSIONED_PREFIX}:${keyring.currentVersion}:`)) {
    decryptSecretValue(value);
    return value;
  }
  if (isEncryptedSecretValue(value)) value = decryptSecretValue(value) ?? "";

  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    keyring.keys.get(keyring.currentVersion)!,
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    VERSIONED_PREFIX,
    String(keyring.currentVersion),
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecretValue(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (!isEncryptedSecretValue(value)) return value;
  if (value.startsWith("v1:")) return decryptLegacyV1(value);
  if (!value.startsWith(`${VERSIONED_PREFIX}:`)) {
    throw new Error("Unsupported encrypted secret version");
  }
  const [, versionRaw, ivRaw, tagRaw, encryptedRaw, ...extra] =
    value.split(":");
  if (
    !versionRaw ||
    !/^[1-9]\d*$/.test(versionRaw) ||
    !ivRaw ||
    !tagRaw ||
    !encryptedRaw ||
    extra.length > 0
  ) {
    throw new Error("Invalid encrypted secret");
  }
  const version = Number(versionRaw);
  const key = getKeyring().keys.get(version);
  if (!key)
    throw new Error(`Platform secret unavailable key version ${version}`);
  return decryptAesGcm(ivRaw, tagRaw, encryptedRaw, key);
}
