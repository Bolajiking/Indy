const RECENT_CONNECTION_SUCCESS_KEY = "indyfren_recent_connection_success_v1";
const PENDING_CONNECTION_TOOLKIT_KEY = "indyfren_pending_connection_toolkit_v1";

export const RECENT_CONNECTION_SUCCESS_TTL_MS = 2 * 60 * 1000;
const PENDING_CONNECTION_TOOLKIT_TTL_MS = 30 * 60 * 1000;

export interface ConnectionAccountLike {
  toolkit: string;
  connected: boolean;
}

/** Where a connect flow was started from — decides where success is surfaced. */
export type ConnectionOrigin = "chat" | "settings";

interface ToolkitHint {
  toolkit: string;
  savedAt: number;
  origin?: ConnectionOrigin;
}

export interface ConnectionCardState {
  active: boolean;
  confirmedConnected: boolean;
  recentlySuccessful: boolean;
  expired: boolean;
  statusText: string;
  statusTone: "success" | "danger" | "muted";
  badgeText: "Linked" | "Success" | null;
  actionLabel: "Connect" | "Reconnect" | "Disconnect" | "Finalizing...";
  canDisconnect: boolean;
}

function normalizeToolkit(toolkit: string | null | undefined): string | null {
  const normalized = toolkit?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function parseHint(raw: string | null): ToolkitHint | null {
  if (!raw) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      "toolkit" in value &&
      "savedAt" in value &&
      typeof value.toolkit === "string" &&
      typeof value.savedAt === "number"
    ) {
      const toolkit = normalizeToolkit(value.toolkit);
      if (!toolkit) return null;
      const origin =
        "origin" in value &&
        (value.origin === "chat" || value.origin === "settings")
          ? value.origin
          : undefined;
      return { toolkit, savedAt: value.savedAt, ...(origin ? { origin } : {}) };
    }
  } catch {
    return null;
  }

  return null;
}

function writeToolkitHint(
  key: string,
  toolkit: string,
  now: number,
  origin?: ConnectionOrigin,
): void {
  const normalized = normalizeToolkit(toolkit);
  const storage = browserStorage();

  if (!normalized || !storage) {
    return;
  }

  try {
    storage.setItem(
      key,
      JSON.stringify({
        toolkit: normalized,
        savedAt: now,
        ...(origin ? { origin } : {}),
      }),
    );
  } catch {
    // Browser privacy settings can block storage; the API refresh remains authoritative.
  }
}

function readToolkitHintEntry(
  key: string,
  ttlMs: number,
  now: number,
): ToolkitHint | null {
  const storage = browserStorage();
  if (!storage) {
    return null;
  }

  const hint = parseHint(storage.getItem(key));
  if (!hint) {
    storage.removeItem(key);
    return null;
  }

  if (now - hint.savedAt > ttlMs) {
    storage.removeItem(key);
    return null;
  }

  return hint;
}

function readToolkitHint(
  key: string,
  ttlMs: number,
  now: number,
): string | null {
  return readToolkitHintEntry(key, ttlMs, now)?.toolkit ?? null;
}

function clearToolkitHint(key: string, toolkit?: string): void {
  const storage = browserStorage();
  if (!storage) {
    return;
  }

  const normalized = normalizeToolkit(toolkit);
  if (!normalized) {
    storage.removeItem(key);
    return;
  }

  const hint = parseHint(storage.getItem(key));
  if (hint?.toolkit === normalized) {
    storage.removeItem(key);
  }
}

export function writeRecentConnectionSuccess(
  toolkit: string,
  now = Date.now(),
): void {
  writeToolkitHint(RECENT_CONNECTION_SUCCESS_KEY, toolkit, now);
}

export function readRecentConnectionSuccess(now = Date.now()): string | null {
  return readToolkitHint(
    RECENT_CONNECTION_SUCCESS_KEY,
    RECENT_CONNECTION_SUCCESS_TTL_MS,
    now,
  );
}

export function clearRecentConnectionSuccess(toolkit?: string): void {
  clearToolkitHint(RECENT_CONNECTION_SUCCESS_KEY, toolkit);
}

export function writePendingConnectionToolkit(
  toolkit: string,
  origin: ConnectionOrigin = "settings",
  now = Date.now(),
): void {
  writeToolkitHint(PENDING_CONNECTION_TOOLKIT_KEY, toolkit, now, origin);
}

export function readPendingConnectionToolkit(now = Date.now()): string | null {
  return readToolkitHint(
    PENDING_CONNECTION_TOOLKIT_KEY,
    PENDING_CONNECTION_TOOLKIT_TTL_MS,
    now,
  );
}

/** The pending connect attempt, with where it was started from. */
export function readPendingConnection(
  now = Date.now(),
): { toolkit: string; origin: ConnectionOrigin } | null {
  const hint = readToolkitHintEntry(
    PENDING_CONNECTION_TOOLKIT_KEY,
    PENDING_CONNECTION_TOOLKIT_TTL_MS,
    now,
  );
  if (!hint) return null;
  return { toolkit: hint.toolkit, origin: hint.origin ?? "settings" };
}

export function clearPendingConnectionToolkit(toolkit?: string): void {
  clearToolkitHint(PENDING_CONNECTION_TOOLKIT_KEY, toolkit);
}

export function resolveConnectionCardState(
  toolkit: string,
  accounts: ConnectionAccountLike[],
  recentSuccessToolkit: string | null,
): ConnectionCardState {
  const normalizedToolkit = normalizeToolkit(toolkit);
  const matchingAccounts = accounts.filter(
    (account) => normalizeToolkit(account.toolkit) === normalizedToolkit,
  );
  const confirmedConnected = matchingAccounts.some(
    (account) => account.connected,
  );
  const recentlySuccessful =
    !confirmedConnected &&
    normalizeToolkit(recentSuccessToolkit) === normalizedToolkit;
  const expired =
    !confirmedConnected &&
    !recentlySuccessful &&
    matchingAccounts.some((account) => !account.connected);
  const active = confirmedConnected || recentlySuccessful;

  if (recentlySuccessful) {
    return {
      active,
      confirmedConnected,
      recentlySuccessful,
      expired,
      statusText: "Connection successful",
      statusTone: "success",
      badgeText: "Success",
      actionLabel: "Finalizing...",
      canDisconnect: false,
    };
  }

  if (confirmedConnected) {
    return {
      active,
      confirmedConnected,
      recentlySuccessful,
      expired,
      statusText: "Connected",
      statusTone: "success",
      badgeText: "Linked",
      actionLabel: "Disconnect",
      canDisconnect: true,
    };
  }

  return {
    active,
    confirmedConnected,
    recentlySuccessful,
    expired,
    statusText: expired ? "Connection expired — reconnect" : "Not connected",
    statusTone: expired ? "danger" : "muted",
    badgeText: null,
    actionLabel: expired ? "Reconnect" : "Connect",
    canDisconnect: false,
  };
}
