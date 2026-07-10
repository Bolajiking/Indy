import type { JsonObject, JsonValue } from "../db/json.js";
import { formatUsd } from "../lib/format.js";

export interface ActionPreview {
  service: string;
  operation: string;
  target: string;
  materialArguments: JsonObject;
  maxCostCents: number;
}

const TARGET_KEYS = [
  "to",
  "recipient",
  "recipient_email",
  "recipients",
  "recipient_emails",
  "target",
  "channel",
  "channel_id",
  "chat_id",
  "space_id",
  "thread_id",
  "user_id",
  "calendar_id",
  "database_id",
  "page_id",
  "parent_id",
  "document_id",
  "spreadsheet_id",
  "file_id",
  "folder_id",
  "drive_id",
  "account_id",
  "repository",
  "repo",
  "url",
  "webhook_url",
] as const;
const SECRET_KEY =
  /(secret|token|password|credential|private.?key|api.?key|authorization|cookie)/i;

export function sanitizeActionTarget(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") {
      // Destinations need to be recognizable, but userinfo, query strings and
      // fragments commonly carry signed credentials and never belong in a UI.
      return `${url.protocol}//${url.host}${url.pathname}`.slice(0, 240);
    }
  } catch {
    // Non-URL targets (email, channel ID, repository) are handled below.
  }
  return trimmed.length > 240
    ? `${trimmed.slice(0, 240)}…[truncated]`
    : trimmed;
}

function safeValue(key: string, value: JsonValue): JsonValue {
  if (SECRET_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") return sanitizeActionTarget(value);
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => {
      if (typeof entry === "string") return sanitizeActionTarget(entry);
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        return sanitizeMaterialArguments(entry);
      }
      return entry;
    });
  }
  if (value && typeof value === "object") {
    return sanitizeMaterialArguments(value);
  }
  return value;
}

export function sanitizeMaterialArguments(input: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, safeValue(key, value)]),
  );
}

export function inferActionTarget(input: JsonObject): string | null {
  for (const key of TARGET_KEYS) {
    const value = input[key];
    if (
      (typeof value === "string" && value.trim().length > 0) ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      return sanitizeActionTarget(String(value));
    }
    if (Array.isArray(value) && value.length > 0) {
      const targets = value.filter(
        (entry): entry is string | number =>
          (typeof entry === "string" && entry.trim().length > 0) ||
          (typeof entry === "number" && Number.isFinite(entry)),
      );
      if (targets.length > 0) {
        return targets
          .map((entry) => sanitizeActionTarget(String(entry)))
          .join(", ");
      }
    }
  }
  return null;
}

export function validateActionPreview(
  preview: Partial<ActionPreview>,
): ActionPreview | null {
  if (
    !preview.service?.trim() ||
    !preview.operation?.trim() ||
    !preview.target?.trim() ||
    !preview.materialArguments ||
    Object.keys(preview.materialArguments).length === 0 ||
    typeof preview.maxCostCents !== "number" ||
    !Number.isFinite(preview.maxCostCents) ||
    preview.maxCostCents < 0
  ) {
    return null;
  }
  return preview as ActionPreview;
}

export function formatActionPreview(preview: ActionPreview): string {
  return [
    "Approval needed",
    `Service: ${preview.service}`,
    `Operation: ${preview.operation}`,
    `Target: ${preview.target}`,
    `Material arguments: ${JSON.stringify(preview.materialArguments)}`,
    `Maximum cost: ${formatUsd(preview.maxCostCents)}`,
  ].join("\n");
}
