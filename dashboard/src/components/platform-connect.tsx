"use client";

import { useState } from "react";
import type {
  DashboardPlatformConnectionInput,
  DashboardPlatformOAuthProvider,
} from "@/lib/api";

const SUPPORTED_PLATFORMS = [
  { id: "youtube", label: "YouTube", icon: "🎬" },
  { id: "instagram", label: "Instagram", icon: "📸" },
  { id: "tiktok", label: "TikTok", icon: "🎵" },
  { id: "twitter", label: "Twitter / X", icon: "🐦" },
  { id: "facebook", label: "Facebook", icon: "📘" },
  { id: "reddit", label: "Reddit", icon: "🟠" },
] as const;

interface PlatformConnection {
  id?: string;
  platform: string;
  platform_username: string | null;
  connected: boolean;
}

function formatConnectedUsername(username: string | null) {
  if (!username) {
    return "connected";
  }

  return username.replace(/^@+/, "").trim() || "connected";
}

export function PlatformConnect({
  connections,
  oauthProviders,
  oauthProviderDiscoveryStatus,
  canManageConnections,
  onConnect,
  onOAuthConnect,
  onDisconnect,
}: {
  connections: PlatformConnection[];
  oauthProviders?: DashboardPlatformOAuthProvider[];
  oauthProviderDiscoveryStatus: "loading" | "loaded" | "failed";
  canManageConnections: boolean;
  onConnect?: (input: DashboardPlatformConnectionInput) => Promise<void>;
  onOAuthConnect?: (platform: string) => Promise<void>;
  onDisconnect?: (platform: string) => Promise<void>;
}) {
  const connectedMap = new Map(connections.map((c) => [c.platform, c]));
  const oauthProviderMap = new Map(
    (oauthProviders ?? []).map((provider) => [provider.platform, provider])
  );
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [refreshTokenInput, setRefreshTokenInput] = useState("");
  const [platformUserIdInput, setPlatformUserIdInput] = useState("");
  const [expiresAtInput, setExpiresAtInput] = useState("");
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [busyPlatform, setBusyPlatform] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<"manual" | "oauth" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const youtubeOAuthEnabled = oauthProviderMap.get("youtube")?.enabled ?? false;
  const youtubeOAuthCopy =
    youtubeOAuthEnabled
      ? "YouTube connects via Google sign-in. Other platforms use manual token entry for now."
      : oauthProviderDiscoveryStatus === "failed"
        ? "We couldn't check YouTube sign-in availability right now. You can still connect using a manual token."
        : oauthProviderDiscoveryStatus === "loading"
          ? "Checking YouTube sign-in availability. Manual token entry is available either way."
          : "YouTube currently uses manual token entry. Google sign-in will appear here when available.";

  function resetInputs(nextPlatform: string | null = null) {
    setConnectingPlatform(nextPlatform);
    setTokenInput("");
    setUsernameInput("");
    setRefreshTokenInput("");
    setPlatformUserIdInput("");
    setExpiresAtInput("");
    setShowAdvancedFields(false);
  }

  async function handleConnect(platform: string) {
    if (!onConnect || !tokenInput.trim()) return;
    setBusyPlatform(platform);
    setBusyMode("manual");
    setError(null);
    try {
      await onConnect({
        platform,
        accessToken: tokenInput.trim(),
        username: usernameInput.trim() || undefined,
        refreshToken: refreshTokenInput.trim() || undefined,
        userId: platformUserIdInput.trim() || undefined,
        expiresAt: expiresAtInput ? new Date(expiresAtInput).toISOString() : undefined,
      });
      resetInputs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setBusyPlatform(null);
      setBusyMode(null);
    }
  }

  async function handleOAuthConnect(platform: string) {
    if (!onOAuthConnect) return;
    setBusyPlatform(platform);
    setBusyMode("oauth");
    setError(null);
    try {
      await onOAuthConnect(platform);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth connection failed");
    } finally {
      setBusyPlatform(null);
      setBusyMode(null);
    }
  }

  async function handleDisconnect(platform: string) {
    if (!onDisconnect) return;
    setBusyPlatform(platform);
    setBusyMode("disconnect");
    setError(null);
    try {
      await onDisconnect(platform);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusyPlatform(null);
      setBusyMode(null);
    }
  }

  return (
    <article
      className="p-6"
      style={{
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-default)',
        background: 'var(--bg-canvas)'
      }}
    >
      <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Connected platforms</p>
      <h3 className="mt-2 text-3xl" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
        Your social accounts
      </h3>
      <p className="mt-3 text-sm leading-7" style={{ color: 'var(--text-tertiary)' }}>
        Connect your social accounts so Indyfren can calculate rates and find
        better brand matches.
      </p>
      <p className="mt-2 text-xs leading-6" style={{ color: 'var(--text-tertiary)' }}>
        {youtubeOAuthCopy}
      </p>

      {error && (
        <p
          className="mt-3 px-4 py-3 text-sm"
          style={{
            borderRadius: '18px',
            border: '1px solid var(--accent-pink-border)',
            background: 'rgba(255, 192, 203, 0.1)',
            color: 'var(--text-primary)'
          }}
        >
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {SUPPORTED_PLATFORMS.map((platform) => {
          const connection = connectedMap.get(platform.id);
          const isExpanded = connectingPlatform === platform.id;
          const oauthProvider = oauthProviderMap.get(platform.id);
          const hasOAuth = platform.id === "youtube" && oauthProvider?.enabled;
          const isPlatformBusy = busyPlatform === platform.id;
          const isManualBusy = isPlatformBusy && busyMode === "manual";
          const isOAuthBusy = isPlatformBusy && busyMode === "oauth";
          const isDisconnectBusy = isPlatformBusy && busyMode === "disconnect";

          return (
            <div key={platform.id}>
              <div
                className="flex items-center justify-between p-4"
                style={{
                  borderRadius: 'var(--radius-card)',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-surface)'
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{platform.icon}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {platform.label}
                    </p>
                    {connection ? (
                      <p className="text-xs" style={{ color: 'var(--accent-green-text)' }}>
                        @{formatConnectedUsername(connection.platform_username)}
                      </p>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Not connected</p>
                    )}
                  </div>
                </div>

                {connection ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        background: 'var(--accent-green-bg)',
                        color: 'var(--accent-green-text)'
                      }}
                    >
                      Connected
                    </span>
                    {canManageConnections && onDisconnect && (
                      <button
                        onClick={() => handleDisconnect(connection.platform)}
                        disabled={isDisconnectBusy}
                        className="rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-50"
                        style={{
                          border: '1px solid var(--accent-pink-border)',
                          background: 'white',
                          color: 'var(--accent-pink)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                      >
                        {isDisconnectBusy ? "Disconnecting..." : "Disconnect"}
                      </button>
                    )}
                  </div>
                ) : canManageConnections && (onConnect || onOAuthConnect) ? (
                  hasOAuth ? (
                    <div className="flex items-center gap-2">
                      {onOAuthConnect ? (
                        <button
                          onClick={() => void handleOAuthConnect(platform.id)}
                          disabled={isPlatformBusy}
                          className="rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-50 hover:opacity-90"
                          style={{
                            background: 'var(--accent-blue)',
                            color: 'white'
                          }}
                        >
                          {isOAuthBusy ? "Redirecting..." : "Connect with Google"}
                        </button>
                      ) : null}
                      {onConnect ? (
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              resetInputs();
                              return;
                            }

                            setError(null);
                            resetInputs(platform.id);
                          }}
                          disabled={isPlatformBusy}
                          className="rounded-full px-4 py-2 text-xs font-semibold"
                          style={{
                            border: '1px solid var(--border-default)',
                            background: 'white',
                            color: 'var(--text-primary)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                        >
                          {isExpanded ? "Hide manual entry" : "Use manual token"}
                        </button>
                      ) : null}
                    </div>
                  ) : onConnect ? (
                    <button
                      onClick={() => {
                        if (isExpanded) {
                          resetInputs();
                          return;
                        }

                        setError(null);
                        resetInputs(platform.id);
                      }}
                      disabled={isPlatformBusy}
                      className="rounded-full px-4 py-2 text-xs font-semibold"
                      style={{
                        border: '1px solid var(--border-default)',
                        background: 'white',
                        color: 'var(--text-primary)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      {isExpanded ? "Cancel" : "Connect"}
                    </button>
                  ) : null
                ) : (
                  <span
                    className="rounded-full px-4 py-2 text-xs font-semibold"
                    style={{
                      border: '1px solid var(--border-light)',
                      background: 'rgba(255, 255, 255, 0.6)',
                      color: 'var(--text-tertiary)'
                    }}
                  >
                    Sign in first
                  </span>
                )}
              </div>

              {isExpanded && (
                <div
                  className="ml-12 mt-2 space-y-2 p-4"
                  style={{
                    borderRadius: '18px',
                    border: '1px solid var(--border-default)',
                    background: 'white'
                  }}
                >
                  {platform.id === "youtube" ? (
                    <p
                      className="px-3 py-2 text-xs leading-6"
                      style={{
                        borderRadius: '14px',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-tertiary)'
                      }}
                    >
                      {hasOAuth
                        ? "Use this only if Google sign-in isn't working for you. Paste your YouTube credentials manually instead."
                        : oauthProviderDiscoveryStatus === "failed"
                          ? "We couldn't check YouTube sign-in right now. You can connect manually in the meantime."
                          : oauthProviderDiscoveryStatus === "loading"
                            ? "Checking YouTube sign-in availability. You can connect manually while that finishes."
                            : "YouTube currently uses manual token entry. Google sign-in will appear when available."}
                    </p>
                  ) : null}
                  <input
                    type="text"
                    placeholder="Username (e.g. @yourhandle)"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm placeholder:opacity-50"
                    style={{
                      borderRadius: '14px',
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <input
                    type="password"
                    placeholder="Access token"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm placeholder:opacity-50"
                    style={{
                      borderRadius: '14px',
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdvancedFields((current) => !current)}
                    className="text-left text-xs font-semibold"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                  >
                    {showAdvancedFields ? "Hide advanced fields" : "Add refresh token or expiry"}
                  </button>
                  {showAdvancedFields ? (
                    <div
                      className="space-y-2 p-3"
                      style={{
                        borderRadius: '14px',
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-surface)'
                      }}
                    >
                      <input
                        type="password"
                        placeholder="Refresh token (optional)"
                        value={refreshTokenInput}
                        onChange={(e) => setRefreshTokenInput(e.target.value)}
                        className="w-full px-3 py-2 text-sm placeholder:opacity-50"
                        style={{
                          borderRadius: '12px',
                          border: '1px solid var(--border-default)',
                          background: 'white',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Platform user ID (optional)"
                        value={platformUserIdInput}
                        onChange={(e) => setPlatformUserIdInput(e.target.value)}
                        className="w-full px-3 py-2 text-sm placeholder:opacity-50"
                        style={{
                          borderRadius: '12px',
                          border: '1px solid var(--border-default)',
                          background: 'white',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <input
                        type="datetime-local"
                        value={expiresAtInput}
                        onChange={(e) => setExpiresAtInput(e.target.value)}
                        className="w-full px-3 py-2 text-sm"
                        style={{
                          borderRadius: '12px',
                          border: '1px solid var(--border-default)',
                          background: 'white',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  ) : null}
                  <button
                    onClick={() => handleConnect(platform.id)}
                    disabled={isManualBusy || !tokenInput.trim()}
                    className="w-full px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:opacity-90"
                    style={{
                      borderRadius: '14px',
                      background: 'var(--accent-pink)',
                      color: 'white'
                    }}
                  >
                    {isManualBusy ? "Connecting..." : `Connect ${platform.label}`}
                  </button>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {hasOAuth
                      ? "Only use this if you already have your own YouTube credentials handy."
                      : platform.id === "youtube"
                        ? "Google sign-in will appear here when available. Manual entry works in the meantime."
                        : "Paste your platform API token. Credentials are encrypted and stored securely."}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
}
