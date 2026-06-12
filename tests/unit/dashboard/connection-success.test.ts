import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RECENT_CONNECTION_SUCCESS_TTL_MS,
  clearPendingConnectionToolkit,
  readPendingConnection,
  readPendingConnectionToolkit,
  readRecentConnectionSuccess,
  resolveConnectionCardState,
  writePendingConnectionToolkit,
  writeRecentConnectionSuccess,
} from "../../../dashboard/src/lib/connection-success";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function installSessionStorage() {
  const sessionStorage = new MemoryStorage();
  vi.stubGlobal("window", { sessionStorage });
  return sessionStorage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveConnectionCardState", () => {
  it("shows confirmed backend connections as linked", () => {
    expect(
      resolveConnectionCardState(
        "gmail",
        [{ toolkit: "gmail", connected: true }],
        null,
      ),
    ).toMatchObject({
      active: true,
      confirmedConnected: true,
      recentlySuccessful: false,
      statusText: "Connected",
      badgeText: "Linked",
      actionLabel: "Disconnect",
      canDisconnect: true,
    });
  });

  it("shows a successful OAuth return while backend confirmation is finalizing", () => {
    expect(resolveConnectionCardState("gmail", [], "gmail")).toMatchObject({
      active: true,
      confirmedConnected: false,
      recentlySuccessful: true,
      statusText: "Connection successful",
      badgeText: "Success",
      actionLabel: "Finalizing...",
      canDisconnect: false,
    });
  });

  it("keeps expired connections on the reconnect path when there is no recent success", () => {
    expect(
      resolveConnectionCardState(
        "gmail",
        [{ toolkit: "gmail", connected: false }],
        null,
      ),
    ).toMatchObject({
      active: false,
      expired: true,
      statusText: "Connection expired — reconnect",
      actionLabel: "Reconnect",
      canDisconnect: false,
    });
  });
});

describe("connection toolkit hints", () => {
  it("stores a pending toolkit before OAuth and clears it after callback handling", () => {
    installSessionStorage();

    writePendingConnectionToolkit(" Gmail ", "settings", 1_000);

    expect(readPendingConnectionToolkit(1_001)).toBe("gmail");

    clearPendingConnectionToolkit("gmail");

    expect(readPendingConnectionToolkit(1_002)).toBeNull();
  });

  it("remembers where the connect flow started so success lands there", () => {
    installSessionStorage();

    writePendingConnectionToolkit("gmail", "chat", 1_000);
    expect(readPendingConnection(1_001)).toEqual({
      toolkit: "gmail",
      origin: "chat",
    });

    // Default origin is settings (pre-origin hints behave the same).
    writePendingConnectionToolkit("notion", undefined, 1_000);
    expect(readPendingConnection(1_001)).toEqual({
      toolkit: "notion",
      origin: "settings",
    });
  });

  it("expires stale recent-success hints", () => {
    installSessionStorage();

    writeRecentConnectionSuccess("gmail", 1_000);

    expect(
      readRecentConnectionSuccess(1_000 + RECENT_CONNECTION_SUCCESS_TTL_MS + 1),
    ).toBeNull();
  });
});
