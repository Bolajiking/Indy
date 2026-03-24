import crypto from "node:crypto";
import { env } from "../config/env.js";

export type MessagingPlatform = "telegram" | "whatsapp";

export const MESSAGING_LINK_TOKEN_TTL_SECONDS = 15 * 60;
const UUID_BYTES = 16;
const TOKEN_SECRET_BYTES = 10;
const TOKEN_BYTES = UUID_BYTES + TOKEN_SECRET_BYTES;

function getLinkSecret() {
  return env.MESSAGING_LINK_SECRET || env.PRIVY_APP_SECRET;
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function hashTokenSecret(secret: Buffer): string {
  return crypto
    .createHmac("sha256", getLinkSecret())
    .update(secret)
    .digest("hex");
}

export function createMessagingLinkToken(input: {
  sessionId: string;
  secret?: Buffer;
}): { token: string; tokenHash: string } {
  const secret = input.secret ?? crypto.randomBytes(TOKEN_SECRET_BYTES);
  const raw = Buffer.alloc(TOKEN_BYTES);
  uuidToBytes(input.sessionId).copy(raw, 0);
  secret.copy(raw, UUID_BYTES);

  return {
    token: raw.toString("base64url"),
    tokenHash: hashTokenSecret(secret),
  };
}

export function verifyMessagingLinkToken(token: string): {
  sessionId: string;
  tokenHash: string;
} | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length !== TOKEN_BYTES) {
      return null;
    }

    const sessionId = bytesToUuid(raw.subarray(0, UUID_BYTES));
    const secret = raw.subarray(UUID_BYTES);
    return { sessionId, tokenHash: hashTokenSecret(secret) };
  } catch {
    return null;
  }
}

export function buildMessagingLinkSession(input: {
  platform: MessagingPlatform;
  token: string;
  expiresAt: Date | string;
}) {
  const expiresAt =
    input.expiresAt instanceof Date
      ? input.expiresAt
      : new Date(input.expiresAt);
  const command =
    input.platform === "telegram"
      ? `/start link_${input.token}`
      : `LINK ${input.token}`;
  const launchUrl =
    input.platform === "telegram"
      ? env.TELEGRAM_BOT_USERNAME.trim()
        ? `https://t.me/${env.TELEGRAM_BOT_USERNAME.trim()}?start=link_${input.token}`
        : null
      : env.WHATSAPP_BUSINESS_PHONE.trim()
        ? `https://wa.me/${env.WHATSAPP_BUSINESS_PHONE.replace(/\D/g, "")}?text=${encodeURIComponent(command)}`
        : null;

  return {
    platform: input.platform,
    token: input.token,
    expiresAt: expiresAt.toISOString(),
    command,
    launchUrl,
  };
}
