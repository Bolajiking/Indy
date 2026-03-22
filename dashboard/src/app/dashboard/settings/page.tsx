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
import { useCallback, useEffect, useState } from "react";

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
  const {
    data: platformData,
    error,
    isLoading: platformDataLoading,
    refresh: refreshPlatformData,
  } = useAuthedQuery<SettingsPlatformData>(
    async (token) => {
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
    },
    {
      connections: [],
      oauthProviders: [],
      oauthProviderDiscoveryStatus: "loading",
    }
  );
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
          Manage your workspace
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
          Connect platforms, update your profile, and control how Indyfren
          spends on your behalf.
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
              Connect Telegram or WhatsApp
            </h3>
            <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
              Link your messaging apps so you can chat with Indyfren on the go.
              Everything stays in sync — messages and approvals work the same across
              all channels.
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
                    ? `Connected chat ID: ${creator.telegram_chat_id}`
                    : "No Telegram chat has been attached to this creator yet."}
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
                      Open your Indyfren Telegram bot and send:
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
                    ? `Connected phone: ${creator.whatsapp_phone}`
                    : "WhatsApp is not attached to this creator yet."}
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
                      Send this message to your Indyfren WhatsApp number:
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
              One conversation, every channel
            </h3>
            <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
              Your messages and approvals stay in sync across the dashboard,
              Telegram, and WhatsApp. Approve a deal here and it disappears
              from Telegram too.
            </p>

            <div className="mt-6 p-4 text-sm leading-7" style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-input)", color: "var(--text-primary)" }}>
              Use Telegram or WhatsApp for quick replies on the go.
              <br />
              Use the dashboard for longer conversations, approvals, and settings.
            </div>
          </article>
        </section>

        {showDebugAccessTokenPanel && accessToken ? (
          <DebugAccessTokenPanel accessToken={accessToken} />
        ) : null}

        <section style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--accent-blue)", padding: 24, color: "white" }}>
          <p style={{ fontSize: 11, color: "white", opacity: 0.55 }}>Account status</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm" style={{ color: "white", opacity: 0.6 }}>Account</p>
            <p className="mt-1 text-sm">
              {creator ? creator.display_name : "No profile created yet."}
            </p>
          </div>
          <div>
            <p className="text-sm" style={{ color: "white", opacity: 0.6 }}>Workspace</p>
            <p className="mt-1 text-sm">
              {onboarding.status === "active"
                ? "Profile and wallet are both ready."
                : onboarding.status === "wallet_pending"
                  ? onboarding.walletProvisioningInProgress
                    ? "Profile ready. Wallet is setting up in the background."
                    : onboarding.walletProvisioningLastError
                      ? `Profile ready. Wallet setup needs a retry.`
                      : "Profile ready. Wallet is still being set up."
                  : "Profile setup is needed to get started."}
            </p>
          </div>
          <div>
            <p className="text-sm" style={{ color: "white", opacity: 0.6 }}>Platform connections</p>
            <p className="mt-1 text-sm">
              YouTube supports Google sign-in. Other platforms use manual token entry.
            </p>
          </div>
          <div>
            <p className="text-sm" style={{ color: "white", opacity: 0.6 }}>Chat channels</p>
            <p className="mt-1 text-sm">
              Telegram and WhatsApp can be linked to your profile for on-the-go access.
            </p>
          </div>
        </div>
      </section>
      </div>
    </DashboardAuthGate>
  );
}
