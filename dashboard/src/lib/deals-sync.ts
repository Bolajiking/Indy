"use client";

/**
 * Reliable deals change notification using BroadcastChannel (same-tab + cross-tab).
 * Falls back to localStorage for older Safari/WebView environments.
 */

const CHANNEL_NAME = "indyfren_deals";
const STORAGE_KEY = "deals_last_updated";

export function broadcastDealsChanged(): void {
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: "deals_changed", ts: Date.now() });
    channel.close();
  } catch {
    // BroadcastChannel not available (old Safari)
  }
  try {
    // localStorage fallback for cross-tab in Safari
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore quota/privacy errors
  }
}

export function subscribeDealsChanged(callback: () => void): () => void {
  let debounceId: ReturnType<typeof setTimeout>;
  const debounced = () => {
    clearTimeout(debounceId);
    debounceId = setTimeout(callback, 200);
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", debounced);
  } catch {
    // BroadcastChannel not available
  }

  // localStorage fallback: fires for cross-tab changes in Safari
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) debounced();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    clearTimeout(debounceId);
    try { channel?.close(); } catch { /* ignore */ }
    window.removeEventListener("storage", onStorage);
  };
}
