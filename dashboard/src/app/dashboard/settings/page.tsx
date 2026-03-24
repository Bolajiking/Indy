"use client";

import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { DebugAccessTokenPanel } from "@/components/debug-access-token-panel";
import { PlatformConnect } from "@/components/platform-connect";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { formatDashboardTime } from "@/lib/datetime";
import { shouldShowDebugAccessTokenPanel } from "@/lib/debug-auth";
import {
  createMessagingLink,
  connectPlatform,
  disconnectPlatform,
  fetchConnections,
  fetchPlatformOAuthProviders,
  startPlatformOAuth,
  type DashboardMessagingLink,
  type DashboardPlatformConnectionInput,
  type DashboardPlatformConnection,
  type DashboardPlatformOAuthProvider,
} from "@/lib/api";
import { useAuth } from "@/lib/privy";
import { useAuthedQuery } from "@/lib/use-authed-query";
import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_DAILY_LIMIT_CENTS = 5000;
const DEFAULT_MONTHLY_LIMIT_CENTS = 50000;
const DEFAULT_PER_TRANSACTION_LIMIT_CENTS = 500;

function centsToUsdInput(value: number): string {
  return (value / 100).toFixed(2);
}

function usdInputToCents(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100);
}

interface SettingsPlatformData {
  connections: DashboardPlatformConnection[];
  oauthProviders: DashboardPlatformOAuthProvider[];
  oauthProviderDiscoveryStatus: "loading" | "loaded" | "failed";
}

export default function SettingsPage() {
  const { creator, onboarding, stage, accessToken, updateProfile, syncing, error: authError } =
    useAuth();
  const settingsFallback = useMemo<SettingsPlatformData>(() => ({
    connections: [],
    oauthProviders: [],
    oauthProviderDiscoveryStatus: "loading",
  }), []);

  // Stable loader — useAuthedQuery uses a ref internally so this only needs to be
  // stable enough not to trigger re-mounts. useCallback with [] gives us that.
  const loadPlatformData = useCallback(async (token: string): Promise<SettingsPlatformData> => {
    const [connections, oauthProvidersResult] = await Promise.all([
      fetchConnections(token),
      fetchPlatformOAuthProviders(token)
        .then((oauthProviders) => ({
          oauthProviders,
          oauthProviderDiscoveryStatus: "loaded" as const,
        }))
        .catch(() => ({
          oauthProviders: [],
          oauthProviderDiscoveryStatus: "failed" as const,
        })),
    ]);

    return {
      connections,
      oauthProviders: oauthProvidersResult.oauthProviders,
      oauthProviderDiscoveryStatus: oauthProvidersResult.oauthProviderDiscoveryStatus,
    };
  }, []);

  const {
    data: platformData,
    error,
    isLoading: platformDataLoading,
    refresh: refreshPlatformData,
  } = useAuthedQuery<SettingsPlatformData>(loadPlatformData, settingsFallback);
  const [perTransactionLimit, setPerTransactionLimit] = useState(
    centsToUsdInput(DEFAULT_PER_TRANSACTION_LIMIT_CENTS)
  );
  const [dailyLimit, setDailyLimit] = useState(centsToUsdInput(DEFAULT_DAILY_LIMIT_CENTS));
  const [monthlyLimit, setMonthlyLimit] = useState(centsToUsdInput(DEFAULT_MONTHLY_LIMIT_CENTS));
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [messagingLinks, setMessagingLinks] = useState<
    Partial<Record<"telegram" | "whatsapp", DashboardMessagingLink>>
  >({});
  const [messagingMessage, setMessagingMessage] = useState<string | null>(null);
  const showDebugAccessTokenPanel = shouldShowDebugAccessTokenPanel({
    nodeEnv: process.env.NODE_ENV,
    authenticated: Boolean(accessToken),
    stage,
    accessToken,
  });

  const connections = platformData.connections;
  const oauthProviders = platformData.oauthProviders;
  const oauthProviderDiscoveryStatus = platformDataLoading
    ? "loading"
    : platformData.oauthProviderDiscoveryStatus;

  useEffect(() => {
    const configuredLimits = creator?.settings?.spending_limits as
      | {
          per_transaction_cents?: number;
          daily_cents?: number;
          monthly_cents?: number;
        }
      | undefined;

    setPerTransactionLimit(
      centsToUsdInput(
        configuredLimits?.per_transaction_cents ?? DEFAULT_PER_TRANSACTION_LIMIT_CENTS
      )
    );
    setDailyLimit(
      centsToUsdInput(configuredLimits?.daily_cents ?? DEFAULT_DAILY_LIMIT_CENTS)
    );
    setMonthlyLimit(
      centsToUsdInput(configuredLimits?.monthly_cents ?? DEFAULT_MONTHLY_LIMIT_CENTS)
    );
  }, [creator?.settings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const params = url.searchParams;
    const oauthStatus = params.get("oauth");
    const platform = params.get("platform");
    const oauthError = params.get("error");

    if (!oauthStatus || !platform) {
      setOauthMessage(null);
      return;
    }

    const platformLabel = platform === "youtube" ? "YouTube" : platform;

    if (oauthStatus === "success") {
      setOauthMessage(`${platformLabel} connected successfully.`);
    } else if (oauthStatus === "error") {
      setOauthMessage(
        `We couldn't connect ${platformLabel} right now${oauthError ? `. ${oauthError.replaceAll("_", " ")}` : ". Try again in a moment."}`
      );
    } else {
      setOauthMessage(null);
    }

    params.delete("oauth");
    params.delete("platform");
    params.delete("error");

    const cleanedSearch = params.toString();
    const cleanedUrl = `${url.pathname}${cleanedSearch ? `?${cleanedSearch}` : ""}${url.hash}`;
    window.history.replaceState({}, "", cleanedUrl);
  }, []);

  const handleConnect = useCallback(
    async (input: DashboardPlatformConnectionInput) => {
      if (!accessToken) return;
      await connectPlatform(accessToken, input);
      await refreshPlatformData();
    },
    [accessToken, refreshPlatformData]
  );

  const handleOAuthConnect = useCallback(
    async (platform: string) => {
      if (!accessToken) return;
      const url = await startPlatformOAuth(accessToken, platform);
      window.location.assign(url);
    },
    [accessToken]
  );

  const handleDisconnect = useCallback(
    async (platform: string) => {
      if (!accessToken) return;
      await disconnectPlatform(accessToken, platform);
      await refreshPlatformData();
    },
    [accessToken, refreshPlatformData]
  );

  const handleLimitSave = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLimitMessage(null);

      const perTransactionCents = usdInputToCents(perTransactionLimit);
      const dailyCents = usdInputToCents(dailyLimit);
      const monthlyCents = usdInputToCents(monthlyLimit);

      if (!perTransactionCents || !dailyCents || !monthlyCents) {
        setLimitMessage("Enter positive dollar amounts for all enforced limits.");
        return;
      }

      await updateProfile({
        settings: {
          spending_limits: {
            ...((creator?.settings?.spending_limits as Record<string, unknown> | undefined) ?? {}),
            per_transaction_cents: perTransactionCents,
            daily_cents: dailyCents,
            monthly_cents: monthlyCents,
          },
        },
      })
        .then(() => {
          setLimitMessage("Spending limits saved.");
        })
        .catch(() => {
          // Auth context exposes the canonical error.
        });
    },
    [creator?.settings, dailyLimit, monthlyLimit, perTransactionLimit, updateProfile]
  );

  const handleMessagingLink = useCallback(
    async (platform: "telegram" | "whatsapp") => {
      if (!accessToken) return;
      setMessagingMessage(null);

      await createMessagingLink(accessToken, platform)
        .then((link) => {
          setMessagingLinks((current) => ({
            ...current,
            [platform]: link,
          }));
          setMessagingMessage(
            `Your ${platform === "telegram" ? "Telegram" : "WhatsApp"} connection steps are ready.`
          );
        })
        .catch((linkError) => {
          setMessagingMessage(
            linkError instanceof Error
              ? linkError.message
              : `Could not prepare ${platform} linking right now.`
          );
        });
    },
    [accessToken]
  );

  return (
    <DashboardAuthGate>
      <div className="space-y-6">
        <section style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "24px 32px" }}>
        <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Settings</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 12, lineHeight: 1, color: "var(--text-primary)" }}>
          Your workspace
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
          Connect your social platforms, set spending limits so Indyfren stays within budget,
          and link Telegram or WhatsApp to manage deals on the go.
        </p>
        {error ? (
          <p className="mt-4 rounded-[18px] px-4 py-3 text-sm" style={{ border: "1px solid var(--accent-pink-border)", background: "var(--accent-pink-bg)", color: "var(--text-primary)" }}>
            {error}
          </p>
        ) : null}
        {oauthMessage ? (
          <p className="mt-4 rounded-[18px] px-4 py-3 text-sm" style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)" }}>
            {oauthMessage}
          </p>
        ) : null}
      </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <PlatformConnect
            connections={connections}
            oauthProviders={oauthProviders}
            oauthProviderDiscoveryStatus={oauthProviderDiscoveryStatus}
            canManageConnections={stage === "wallet_pending" || stage === "active"}
            onConnect={handleConnect}
            onOAuthConnect={handleOAuthConnect}
            onDisconnect={handleDisconnect}
          />

          <article style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-canvas)", padding: 24 }}>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Spending controls</p>
          <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>
            Set your limits
          </h3>

          <form className="mt-6 space-y-4" onSubmit={handleLimitSave}>
            <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-input)", padding: 16 }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Per-transaction limit</p>
                <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--accent-pink)" }}>
                  <span>$</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={perTransactionLimit}
                    onChange={(event) => setPerTransactionLimit(event.target.value)}
                    className="w-24 rounded-[12px] bg-white px-3 py-2 text-right text-sm"
                    style={{ border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                The most Indyfren can spend on a single action.
              </p>
            </div>

            <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-input)", padding: 16 }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Daily limit</p>
                <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--accent-pink)" }}>
                  <span>$</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={dailyLimit}
                    onChange={(event) => setDailyLimit(event.target.value)}
                    className="w-24 rounded-[12px] bg-white px-3 py-2 text-right text-sm"
                    style={{ border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                Total your agent can spend in a day.
              </p>
            </div>

            <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-input)", padding: 16 }}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Monthly limit</p>
                <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--accent-pink)" }}>
                  <span>$</span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={monthlyLimit}
                    onChange={(event) => setMonthlyLimit(event.target.value)}
                    className="w-24 rounded-[12px] bg-white px-3 py-2 text-right text-sm"
                    style={{ border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                Total your agent can spend in a month.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={syncing}
                className="transition hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--accent-blue)", color: "white", borderRadius: "var(--radius-button)", padding: "10px 20px", fontSize: 13, fontWeight: 600 }}
              >
                {syncing ? "Saving..." : "Save limits"}
              </button>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                These limits are enforced automatically on every paid action.
              </p>
            </div>
          </form>

          {limitMessage || authError ? (
            <p className="mt-5 rounded-[18px] px-4 py-3 text-sm" style={{ border: "1px solid var(--border-default)", background: "white", color: "var(--text-primary)" }}>
              {authError ?? limitMessage}
            </p>
          ) : (
            <p className="mt-5 text-xs" style={{ color: "var(--text-tertiary)" }}>
              These limits control how much Indyfren can spend on research, email, and other paid tools.
            </p>
          )}
        </article>
      </section>

        <ProfileSettingsForm />

        <section className="grid gap-6 lg:grid-cols-2">
          <article style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-canvas)", padding: 24 }}>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Chat channels</p>
            <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>
              Manage deals from your phone
            </h3>
            <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
              Connect Telegram or WhatsApp to get deal alerts, approve pitches, and
              chat with Indyfren wherever you are. Everything syncs instantly with
              your dashboard.
            </p>

            <div className="mt-6 space-y-4">
              <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-input)", padding: 16 }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-tertiary)" }}>
                      Telegram
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "var(--text-primary)" }}>
                    {creator?.telegram_chat_id
                      ? "Telegram is connected. You can chat with Indyfren directly from the app."
                      : "Not connected yet. Link your Telegram account to manage deals on the go."}
                  </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleMessagingLink("telegram");
                    }}
                    className="transition hover:opacity-90"
                    style={{ background: "var(--accent-blue)", color: "white", borderRadius: "var(--radius-button)", padding: "10px 20px", fontSize: 13, fontWeight: 600 }}
                  >
                    {creator?.telegram_chat_id ? "Refresh link" : "Connect"}
                  </button>
                </div>
                {messagingLinks.telegram ? (
                  <div className="mt-4 rounded-[18px] p-4 text-sm" style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)" }}>
                    <p className="font-semibold">Next step</p>
                    <p className="mt-2 leading-7">
                      Open the Indyfren Telegram bot and send this command:
                    </p>
                    <code className="mt-2 block rounded-[14px] px-3 py-2 text-xs" style={{ background: "var(--bg-input)" }}>
                      {messagingLinks.telegram.command}
                    </code>
                    {messagingLinks.telegram.launchUrl ? (
                      <a
                        href={messagingLinks.telegram.launchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-xs font-semibold"
                        style={{ color: "var(--accent-pink)" }}
                      >
                        Open Telegram bot
                      </a>
                    ) : null}
                    <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      Expires {formatDashboardTime(messagingLinks.telegram.expiresAt)}.
                    </p>
                  </div>
                ) : null}
              </div>

              <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-input)", padding: 16 }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-tertiary)" }}>
                      WhatsApp
                    </p>
                    <p className="mt-2 text-sm" style={{ color: "var(--text-primary)" }}>
                    {creator?.whatsapp_phone
                      ? "WhatsApp is connected. Reply to approvals and get deal alerts from your phone."
                      : "Not connected yet. Link WhatsApp to get deal alerts and approve actions from any device."}
                  </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handleMessagingLink("whatsapp");
                    }}
                    className="transition hover:opacity-90"
                    style={{ background: "var(--accent-blue)", color: "white", borderRadius: "var(--radius-button)", padding: "10px 20px", fontSize: 13, fontWeight: 600 }}
                  >
                    {creator?.whatsapp_phone ? "Refresh link" : "Connect"}
                  </button>
                </div>
                {messagingLinks.whatsapp ? (
                  <div className="mt-4 rounded-[18px] p-4 text-sm" style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)" }}>
                    <p className="font-semibold">Next step</p>
                    <p className="mt-2 leading-7">
                      Send this message to the Indyfren WhatsApp number:
                    </p>
                    <code className="mt-2 block rounded-[14px] px-3 py-2 text-xs" style={{ background: "var(--bg-input)" }}>
                      {messagingLinks.whatsapp.command}
                    </code>
                    {messagingLinks.whatsapp.launchUrl ? (
                      <a
                        href={messagingLinks.whatsapp.launchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-xs font-semibold"
                        style={{ color: "var(--accent-pink)" }}
                      >
                        Open WhatsApp
                      </a>
                    ) : null}
                    <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
                      Expires {formatDashboardTime(messagingLinks.whatsapp.expiresAt)}.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            {messagingMessage ? (
              <p className="mt-4 rounded-[18px] px-4 py-3 text-sm" style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)" }}>
                {messagingMessage}
              </p>
            ) : null}
          </article>

          <article style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-canvas)", padding: 24 }}>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>How it works</p>
            <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>
              One agent, every channel
            </h3>
            <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
              Indyfren works the same whether you message it on Telegram, WhatsApp,
              or through this dashboard. Approve a deal on your phone and it updates
              everywhere instantly.
            </p>

            <div className="mt-6 space-y-3">
              {[
                { icon: "📱", label: "Telegram & WhatsApp", detail: "Quick approvals and deal alerts while you're on the go" },
                { icon: "💻", label: "Dashboard", detail: "Full deal pipeline, reports, wallet, and settings" },
                { icon: "⚡", label: "Always in sync", detail: "Everything updates in real time across all channels" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3 p-3" style={{ borderRadius: "var(--radius-chip)", border: "1px solid var(--border-default)", background: "var(--bg-input)" }}>
                  <span style={{ fontSize: 18 }}>{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        {showDebugAccessTokenPanel && accessToken ? (
          <DebugAccessTokenPanel accessToken={accessToken} />
        ) : null}

        <section style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--gradient-approval)", padding: 24, color: "white" }}>
          <p style={{ fontSize: 11, color: "white", opacity: 0.55 }}>Account</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm" style={{ color: "white", opacity: 0.6 }}>Name</p>
              <p className="mt-1 text-sm font-semibold">
                {creator ? creator.display_name : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm" style={{ color: "white", opacity: 0.6 }}>Status</p>
              <p className="mt-1 text-sm font-semibold">
                {stage === "active"
                  ? "Active — all systems ready"
                  : stage === "wallet_pending"
                    ? "Setting up wallet in the background"
                    : "Getting started"}
              </p>
            </div>
            <div>
              <p className="text-sm" style={{ color: "white", opacity: 0.6 }}>Connected platforms</p>
              <p className="mt-1 text-sm font-semibold">
                {connections.length > 0
                  ? `${connections.length} platform${connections.length === 1 ? "" : "s"} connected`
                  : "No platforms connected yet"}
              </p>
            </div>
            <div>
              <p className="text-sm" style={{ color: "white", opacity: 0.6 }}>Chat channels</p>
              <p className="mt-1 text-sm font-semibold">
                {[creator?.telegram_chat_id && "Telegram", creator?.whatsapp_phone && "WhatsApp"].filter(Boolean).join(" & ") || "None connected yet"}
              </p>
            </div>
          </div>
        </section>
      </div>
    </DashboardAuthGate>
  );
}
