"use client";

import { useEffect, useRef, useState } from "react";

import {
  BrandGlyph,
  FrenBadge,
  Icon,
  type IconName,
} from "@/components/cf/primitives";
import { useTheme } from "@/components/cf/theme";
import { useShell, type SettingsPane } from "@/components/cf/shell-context";
import { WalletPane } from "@/components/cf/panes/wallet-pane";
import { ReportsPane } from "@/components/cf/panes/reports-pane";
import {
  clearPendingConnectionToolkit,
  clearRecentConnectionSuccess,
  readRecentConnectionSuccess,
  resolveConnectionCardState,
  writePendingConnectionToolkit,
  type ConnectionAccountLike,
} from "@/lib/connection-success";
import {
  createMessagingLink,
  downloadAccountExport,
  disconnectConnection,
  fetchConnectionsInfo,
  fetchDeals,
  fetchTransactions,
  initiateConnection,
  requestAccountDeletion,
  fetchAccountDeletionStatus,
  retryAccountDeletion,
  type DashboardAccountDeletion,
  type DashboardConnectionsInfo,
  type DashboardMessagingLink,
  type DashboardMessagingPlatform,
} from "@/lib/api";
import {
  ACCOUNT_DELETE_CONFIRMATION,
  canSubmitAccountDeletion,
  clearAccountDeletionReceipt,
  purgeAccountBrowserState,
  readAccountDeletionReceipt,
  writeAccountDeletionReceipt,
} from "@/lib/account-settings";
import { useAuthedQuery } from "@/lib/use-authed-query";
import { useAuth } from "@/lib/auth-context";
import { publicSupportEmail } from "@/lib/public-config";

const NAV: Array<{
  k?: SettingsPane;
  label?: string;
  icon?: IconName;
  sep?: boolean;
}> = [
  { k: "account", label: "Account", icon: "user" },
  { k: "subscription", label: "Subscription", icon: "card" },
  { k: "wallet", label: "Wallet", icon: "wallet" },
  { k: "reports", label: "Reports", icon: "spark" },
  { k: "connections", label: "Connections", icon: "link2" },
  { k: "channels", label: "Channels", icon: "newchat" },
  { k: "appearance", label: "Appearance", icon: "palette" },
  { sep: true },
  { k: "referrals", label: "Referrals", icon: "gift" },
  { k: "usage", label: "Usage", icon: "database" },
];

const TITLES: Record<SettingsPane, string> = {
  account: "Account",
  subscription: "Subscription",
  wallet: "Wallet",
  reports: "Reports",
  connections: "Connections",
  channels: "Channels",
  appearance: "Appearance",
  referrals: "Referrals",
  usage: "Usage",
};

function SecLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow" style={{ margin: "26px 0 11px" }}>
      {children}
    </div>
  );
}

/* ───────── Account ───────── */
function PaneAccount() {
  const { creator, user, accessToken, updateProfile, syncing, logout } =
    useAuth();
  const [name, setName] = useState(creator?.display_name ?? "");
  const [niche, setNiche] = useState(creator?.niche ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [accountBusy, setAccountBusy] = useState<"export" | "delete" | null>(
    null,
  );
  const [showDelete, setShowDelete] = useState(false);
  const [deletionReceipt, setDeletionReceipt] = useState<{
    token: string;
    expiresAt: string;
  } | null>(null);
  const [deletionStatus, setDeletionStatus] =
    useState<DashboardAccountDeletion | null>(null);
  useEffect(() => {
    setName(creator?.display_name ?? "");
    setNiche(creator?.niche ?? "");
  }, [creator?.display_name, creator?.niche]);
  useEffect(() => setDeletionReceipt(readAccountDeletionReceipt()), []);
  useEffect(() => {
    if (!deletionReceipt) return;
    let cancelled = false;
    let timer: number | null = null;
    const poll = async () => {
      try {
        const status = await fetchAccountDeletionStatus(deletionReceipt.token);
        if (cancelled) return;
        setDeletionStatus(status);
        setMsg(
          status.state === "retryable-failure"
            ? "Cleanup paused and can be retried."
            : status.state === "completed"
              ? "Deletion completed. Signing out…"
              : `Deletion progress: ${status.state.replaceAll("-", " ")}…`,
        );
        if (status.sessionEnds) {
          if (timer !== null) window.clearInterval(timer);
          clearAccountDeletionReceipt();
          purgeAccountBrowserState();
          await logout();
        }
      } catch (error) {
        if (!cancelled)
          setMsg(
            error instanceof Error
              ? error.message
              : "Couldn't check deletion progress.",
          );
      }
    };
    void poll();
    timer = window.setInterval(() => void poll(), 2_000);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
    };
  }, [deletionReceipt, logout]);
  const email =
    (user as { email?: { address?: string } } | null)?.email?.address ?? "—";

  async function save() {
    setMsg(null);
    try {
      await updateProfile({
        displayName: name.trim() || undefined,
        niche: niche.trim() || undefined,
      });
      setMsg("Saved.");
    } catch {
      setMsg("Couldn't save.");
    }
  }
  async function downloadData() {
    if (!accessToken) return;
    setAccountBusy("export");
    setMsg(null);
    try {
      const blob = await downloadAccountExport(accessToken);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `indyfren-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMsg("Your export has downloaded.");
    } catch (error) {
      setMsg(
        error instanceof Error ? error.message : "Couldn't download your data.",
      );
    } finally {
      setAccountBusy(null);
    }
  }

  async function deleteAccount() {
    if (!accessToken || !canSubmitAccountDeletion(deletePhrase)) return;
    setAccountBusy("delete");
    setMsg("Requesting deletion…");
    try {
      const result = await requestAccountDeletion(accessToken, deletePhrase);
      if (result.receiptToken && result.receiptExpiresAt) {
        const receipt = {
          token: result.receiptToken,
          expiresAt: result.receiptExpiresAt,
        };
        writeAccountDeletionReceipt(receipt.token, receipt.expiresAt);
        setDeletionReceipt(receipt);
        setDeletionStatus(result);
        setMsg(
          "Deletion requested. Keep this page open while cleanup completes.",
        );
        setAccountBusy(null);
      }
    } catch (error) {
      setMsg(
        error instanceof Error
          ? `${error.message} Retry here or contact ${publicSupportEmail}.`
          : `Deletion couldn't start. Retry or contact ${publicSupportEmail}.`,
      );
      setAccountBusy(null);
    }
  }
  async function retryDeletion() {
    if (!deletionReceipt) return;
    setAccountBusy("delete");
    try {
      const status = await retryAccountDeletion(deletionReceipt.token);
      setDeletionStatus(status);
      setMsg("Cleanup retry started.");
    } catch (error) {
      setMsg(
        error instanceof Error
          ? `${error.message} Contact ${publicSupportEmail}.`
          : `Retry failed. Contact ${publicSupportEmail}.`,
      );
    } finally {
      setAccountBusy(null);
    }
  }
  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 99,
            margin: "0 auto 12px",
            background: "var(--cf-cta-gradient)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <FrenBadge
            pose="mark"
            size={44}
            radius={99}
            bg="transparent"
            color="var(--cf-dark-blue)"
          />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          {creator?.display_name ?? "Creator"}
        </div>
        <div style={{ fontSize: 14, color: "rgb(var(--ink) / 0.5)" }}>
          {email}
        </div>
      </div>
      <SecLabel>Profile</SecLabel>
      <div
        className="field-group"
        style={{ background: "rgb(var(--ink) / 0.03)" }}
      >
        <div className="field-row">
          <label>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="field-row">
          <label>Niche</label>
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. Beauty"
          />
        </div>
      </div>
      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <button
          className="dark-pill dark-pill--solid"
          style={{ height: 38 }}
          disabled={syncing}
          onClick={() => void save()}
        >
          {syncing ? "Saving…" : "Save profile"}
        </button>
        {msg && (
          <span style={{ fontSize: 13, color: "rgb(var(--ink) / 0.6)" }}>
            {msg}
          </span>
        )}
      </div>
      <SecLabel>Account</SecLabel>
      <div
        className="field-group"
        style={{ background: "rgb(var(--ink) / 0.03)" }}
      >
        <div className="field-row">
          <label>Email</label>
          <span style={{ color: "rgb(var(--ink) / 0.6)" }}>{email}</span>
        </div>
        <div className="field-row">
          <label>Status</label>
          <span style={{ color: "rgb(var(--ink) / 0.6)" }}>Active · Free</span>
        </div>
      </div>
      <SecLabel>Your data</SecLabel>
      <p style={{ fontSize: 13, color: "rgb(var(--ink) / 0.56)" }}>
        Download a JSON copy of your profile, deals, activity, messages, and
        connection metadata.
      </p>
      <button
        className="dark-pill"
        disabled={!accessToken || accountBusy !== null}
        onClick={() => void downloadData()}
      >
        {accountBusy === "export" ? "Preparing…" : "Download my data"}
      </button>
      <SecLabel>Danger zone</SecLabel>
      {deletionStatus?.state === "retryable-failure" && (
        <button
          className="dark-pill"
          onClick={() => void retryDeletion()}
          disabled={accountBusy !== null}
        >
          Retry account cleanup
        </button>
      )}
      {!showDelete ? (
        <button
          className="dark-pill"
          style={{ color: "var(--cf-coral)" }}
          onClick={() => setShowDelete(true)}
        >
          Delete account
        </button>
      ) : (
        <div
          role="group"
          aria-labelledby="delete-account-heading"
          className="field-group"
          style={{ padding: 16 }}
        >
          <strong id="delete-account-heading">
            Permanently delete this account
          </strong>
          <p style={{ fontSize: 13, lineHeight: 1.5 }}>
            This removes Indyfren data and revokes connections. Public
            blockchain history remains, and Privy archives/disassociates
            embedded wallets. Type{" "}
            <strong>{ACCOUNT_DELETE_CONFIRMATION}</strong> exactly.
          </p>
          <label htmlFor="delete-account-confirmation" style={{ fontSize: 13 }}>
            Confirmation phrase
          </label>
          <input
            id="delete-account-confirmation"
            aria-describedby="delete-account-help"
            value={deletePhrase}
            onChange={(event) => setDeletePhrase(event.target.value)}
          />
          <span id="delete-account-help" style={{ fontSize: 12 }}>
            If cleanup cannot start, you can retry here or email
            {publicSupportEmail}.
          </span>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              className="dark-pill"
              onClick={() => setShowDelete(false)}
              disabled={accountBusy === "delete"}
            >
              Cancel
            </button>
            <button
              className="dark-pill dark-pill--solid"
              style={{ background: "var(--cf-coral)" }}
              disabled={
                !canSubmitAccountDeletion(deletePhrase) || accountBusy !== null
              }
              onClick={() => void deleteAccount()}
            >
              {accountBusy === "delete" ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Subscription ───────── */
function PaneSubscription() {
  return (
    <div>
      <div
        className="gcard"
        style={{
          padding: 22,
          marginBottom: 14,
          background: "var(--cf-cta-gradient)",
          border: "none",
          color: "var(--cf-dark-blue)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            opacity: 0.6,
            marginBottom: 8,
          }}
        >
          Current plan
        </div>
        <div
          style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          Indyfren Free
        </div>
        <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
          $10 in agent credits · all 12 skills · no card required
        </div>
      </div>
      <SecLabel>What&apos;s included</SecLabel>
      <div
        className="field-group"
        style={{ background: "rgb(var(--ink) / 0.03)" }}
      >
        {[
          "Brand deal scanning",
          "Auto-drafted pitches & replies",
          "Contract review",
          "Rate intelligence",
          "Morning brief",
        ].map((f) => (
          <div
            key={f}
            className="field-row"
            style={{ justifyContent: "flex-start", gap: 11 }}
          >
            {Icon.check({ size: 17, color: "var(--cf-grad-end)" })}
            <span style={{ fontSize: 14.5, fontWeight: 500 }}>{f}</span>
          </div>
        ))}
      </div>
      <p
        style={{ fontSize: 13, color: "rgb(var(--ink) / 0.5)", marginTop: 16 }}
      >
        Pro — unlimited runs, deeper analytics, and first access to new skills —
        is coming soon.
      </p>
    </div>
  );
}

/* ───────── Connections ───────── */
const TOOLKIT_LABEL: Record<string, string> = {
  gmail: "Gmail",
  googlecalendar: "Google Calendar",
  googledrive: "Google Drive",
  notion: "Notion",
  slack: "Slack",
  stripe: "Stripe",
  github: "GitHub",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
};
const TOOLKIT_GLYPH: Record<string, string> = {
  gmail: "Gmail",
  googlecalendar: "Calendar",
  googledrive: "Google Drive",
  notion: "Notion",
  stripe: "Stripe",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
};
function toolkitLabel(slug: string) {
  return TOOLKIT_LABEL[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

const EMPTY_CONN: DashboardConnectionsInfo = {
  enabled: false,
  toolkits: [],
  accounts: [],
};

function PaneConnections() {
  const { accessToken } = useAuth();
  const { data, refresh } = useAuthedQuery(
    fetchConnectionsInfo,
    EMPTY_CONN,
    "indyfren_connections_v1",
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [recentSuccessToolkit, setRecentSuccessToolkit] = useState<
    string | null
  >(null);

  useEffect(() => {
    setRecentSuccessToolkit(readRecentConnectionSuccess());
  }, []);

  // A connection is briefly INITIALIZING right after OAuth; re-poll so it flips
  // to Connected without the user manually refreshing.
  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 2500);
    return () => clearTimeout(timer);
  }, [refresh]);

  // While a just-completed connect is still unconfirmed by the API, keep
  // polling (re-armed after each response, capped) until it flips to Connected.
  const pollCount = useRef(0);
  useEffect(() => {
    pollCount.current = 0;
  }, [recentSuccessToolkit]);
  useEffect(() => {
    if (!recentSuccessToolkit || pollCount.current >= 10) return;
    const timer = setTimeout(() => {
      pollCount.current += 1;
      void refresh();
    }, 3000);
    return () => clearTimeout(timer);
  }, [recentSuccessToolkit, data.accounts, refresh]);

  useEffect(() => {
    if (
      recentSuccessToolkit &&
      data.accounts.some(
        (account: ConnectionAccountLike) =>
          account.toolkit.toLowerCase() === recentSuccessToolkit &&
          account.connected,
      )
    ) {
      clearRecentConnectionSuccess(recentSuccessToolkit);
      setRecentSuccessToolkit(null);
    }
  }, [data.accounts, recentSuccessToolkit]);

  async function connect(slug: string) {
    if (!accessToken) return;
    setBusy(slug);
    setMsg(null);
    clearRecentConnectionSuccess(slug);
    setRecentSuccessToolkit((current) => (current === slug ? null : current));
    try {
      writePendingConnectionToolkit(slug);
      const url = await initiateConnection(accessToken, slug);
      window.location.assign(url);
    } catch (e) {
      clearPendingConnectionToolkit(slug);
      setMsg(e instanceof Error ? e.message : "Couldn't start the connection.");
      setBusy(null);
    }
  }

  async function disconnect(slug: string) {
    if (!accessToken) return;
    setBusy(slug);
    setMsg(null);
    try {
      clearRecentConnectionSuccess(slug);
      clearPendingConnectionToolkit(slug);
      setRecentSuccessToolkit((current) => (current === slug ? null : current));
      await disconnectConnection(accessToken, slug);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't disconnect.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <p
        style={{
          fontSize: 14,
          color: "rgb(var(--ink) / 0.6)",
          margin: "0 0 18px",
        }}
      >
        Connect the apps Indyfren works on your behalf — read your inbox, manage
        your calendar, track revenue, and more.
      </p>
      {msg && (
        <p style={{ fontSize: 13, color: "var(--cf-coral)", marginBottom: 12 }}>
          {msg}
        </p>
      )}
      {!data.enabled ? (
        <p style={{ fontSize: 13.5, color: "rgb(var(--ink) / 0.5)" }}>
          Connections aren&apos;t configured yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {data.toolkits.map((slug: string) => {
            const state = resolveConnectionCardState(
              slug,
              data.accounts,
              recentSuccessToolkit,
            );
            return (
              <div
                key={slug}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  padding: "13px 15px",
                  background: "rgb(var(--ink) / 0.03)",
                  border: "1px solid rgb(var(--ink) / 0.07)",
                  borderRadius: 16,
                }}
              >
                <BrandGlyph
                  name={TOOLKIT_GLYPH[slug] ?? toolkitLabel(slug)}
                  size={38}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>
                    {toolkitLabel(slug)}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color:
                        state.statusTone === "success"
                          ? "var(--cf-grad-end)"
                          : state.statusTone === "danger"
                            ? "var(--cf-coral)"
                            : "rgb(var(--ink) / 0.45)",
                    }}
                  >
                    {state.statusText}
                  </div>
                </div>
                {state.active ? (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--cf-grad-end)",
                      }}
                    >
                      {Icon.check({ size: 16, color: "var(--cf-grad-end)" })}{" "}
                      {state.badgeText}
                    </span>
                    <button
                      className="dark-pill"
                      style={{ height: 36 }}
                      disabled={busy === slug || !state.canDisconnect}
                      onClick={() => void disconnect(slug)}
                    >
                      {busy === slug ? "…" : state.actionLabel}
                    </button>
                  </div>
                ) : (
                  <button
                    className="dark-pill dark-pill--solid"
                    style={{ height: 36 }}
                    disabled={busy === slug}
                    onClick={() => void connect(slug)}
                  >
                    {busy === slug ? "Starting…" : state.actionLabel}
                  </button>
                )}
              </div>
            );
          })}
          <button
            className="dark-pill"
            style={{ height: 34, alignSelf: "flex-start" }}
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────── Channels ───────── */
function PaneChannels() {
  const { creator, accessToken } = useAuth();
  const [links, setLinks] = useState<
    Partial<Record<DashboardMessagingPlatform, DashboardMessagingLink>>
  >({});
  const [msg, setMsg] = useState<string | null>(null);
  async function link(platform: DashboardMessagingPlatform) {
    if (!accessToken) return;
    setMsg(null);
    try {
      const created = await createMessagingLink(accessToken, platform);
      setLinks((c) => ({ ...c, [platform]: created }));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't prepare linking.");
    }
  }
  const rows = [
    ["telegram", "Telegram", "#27A7E7", "T", !!creator?.telegram_chat_id],
    ["whatsapp", "WhatsApp", "#25D366", "W", !!creator?.whatsapp_phone],
  ] as const;
  return (
    <div>
      <p
        style={{
          fontSize: 14,
          color: "rgb(var(--ink) / 0.6)",
          margin: "0 0 18px",
        }}
      >
        Chat with Indyfren and approve deals from your phone — perfectly in sync
        with here.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map(([key, label, color, letter, linked]) => (
          <div
            key={key}
            style={{
              background: "rgb(var(--ink) / 0.03)",
              border: "1px solid rgb(var(--ink) / 0.07)",
              borderRadius: 16,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: color,
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                {letter}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{label}</div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: linked
                      ? "var(--cf-grad-end)"
                      : "rgb(var(--ink) / 0.45)",
                  }}
                >
                  {linked ? "Connected · in sync" : "Not linked"}
                </div>
              </div>
              <button
                className="dark-pill dark-pill--solid"
                style={{ height: 36 }}
                onClick={() => void link(key)}
              >
                {linked ? "Refresh link" : "Link"}
              </button>
            </div>
            {links[key] && (
              <div
                style={{
                  marginTop: 12,
                  background: "rgb(var(--ink) / 0.04)",
                  border: "1px solid rgb(var(--ink) / 0.07)",
                  borderRadius: 12,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Next step
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "rgb(var(--ink) / 0.6)",
                    marginBottom: 8,
                  }}
                >
                  Send this to the Indyfren {label} bot:
                </div>
                <code
                  style={{
                    display: "block",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12.5,
                    background: "rgb(var(--ink) / 0.06)",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  {links[key]!.command}
                </code>
                {links[key]!.launchUrl && (
                  <a
                    href={links[key]!.launchUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "var(--cf-accent-blue)",
                    }}
                  >
                    Open {label} →
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {msg && (
        <p style={{ fontSize: 13, color: "var(--cf-coral)", marginTop: 12 }}>
          {msg}
        </p>
      )}
    </div>
  );
}

/* ───────── Appearance ───────── */
function PaneAppearance() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <SecLabel>Theme</SecLabel>
      <div style={{ display: "flex", gap: 12 }}>
        {(["dark", "light"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTheme(k)}
            style={{
              flex: 1,
              padding: "18px 16px",
              borderRadius: 18,
              textAlign: "left",
              background:
                theme === k
                  ? "rgb(var(--ink) / 0.07)"
                  : "rgb(var(--ink) / 0.03)",
              border:
                theme === k
                  ? "2px solid var(--cf-secondary)"
                  : "2px solid rgb(var(--ink) / 0.08)",
            }}
          >
            <div
              style={{
                height: 64,
                borderRadius: 12,
                marginBottom: 12,
                background:
                  k === "dark"
                    ? "radial-gradient(120% 120% at 50% 120%, #4f7bff, #2a1f63 60%, #0a0a16)"
                    : "radial-gradient(120% 120% at 50% 120%, #5d6cf6, #a982dd 45%, #efe6ef)",
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {k === "dark"
                ? Icon.moon({
                    size: 17,
                    color:
                      theme === k
                        ? "var(--cf-secondary)"
                        : "rgb(var(--ink) / 0.6)",
                  })
                : Icon.sun({
                    size: 17,
                    color:
                      theme === k
                        ? "var(--cf-secondary)"
                        : "rgb(var(--ink) / 0.6)",
                  })}
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  textTransform: "capitalize",
                  color:
                    theme === k ? "rgb(var(--ink))" : "rgb(var(--ink) / 0.6)",
                }}
              >
                {k}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────── Referrals ───────── */
function PaneReferrals() {
  const { creator } = useAuth();
  const slug =
    (creator?.display_name ?? "you")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 20) || "you";
  const link = `indyfren.com/r/${slug}`;
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div
        className="gcard"
        style={{ padding: 24, marginBottom: 16, textAlign: "center" }}
      >
        {Icon.gift({ size: 30, color: "var(--cf-grad-end)" })}
        <div style={{ fontSize: 20, fontWeight: 700, margin: "12px 0 4px" }}>
          Give $10, get $10
        </div>
        <p
          style={{
            fontSize: 14,
            color: "rgb(var(--ink) / 0.55)",
            margin: "0 0 18px",
          }}
        >
          When a fren joins Indyfren and runs their first scan, you both get $10
          of agent credit.
        </p>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            className="cf-mono"
            style={{
              fontFamily: "var(--font-mono)",
              flex: "1 1 240px",
              maxWidth: 280,
              fontSize: 14,
              fontWeight: 600,
              background: "rgb(var(--ink) / 0.05)",
              border: "1px solid rgb(var(--ink) / 0.08)",
              borderRadius: 12,
              padding: "12px 16px",
            }}
          >
            {link}
          </div>
          <button
            className="dark-pill dark-pill--solid"
            onClick={() => {
              void navigator.clipboard.writeText(`https://${link}`).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Usage ───────── */
function PaneUsage() {
  const { data: deals } = useAuthedQuery(fetchDeals, [], "indyfren_deals_v1");
  const { data: txns } = useAuthedQuery(
    fetchTransactions,
    [],
    "indyfren_txns_v1",
  );
  const pitched = deals.filter((d) =>
    [
      "pitched",
      "responded",
      "negotiating",
      "contracted",
      "active",
      "completed",
    ].includes(d.stage),
  ).length;
  const bars = [
    {
      l: "Brand deals discovered",
      n: deals.length,
      max: Math.max(10, deals.length),
    },
    { l: "Pitches in flight", n: pitched, max: Math.max(10, deals.length) },
    { l: "Agent actions", n: txns.length, max: Math.max(20, txns.length) },
  ];
  return (
    <div>
      <p
        style={{
          fontSize: 14,
          color: "rgb(var(--ink) / 0.6)",
          margin: "0 0 20px",
        }}
      >
        Your activity so far.
      </p>
      <div style={{ display: "grid", gap: 18 }}>
        {bars.map((b) => (
          <div key={b.l}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>{b.l}</span>
              <span style={{ fontSize: 13.5, color: "rgb(var(--ink) / 0.5)" }}>
                {b.n}
              </span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 99,
                background: "rgb(var(--ink) / 0.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, (b.n / b.max) * 100)}%`,
                  height: "100%",
                  borderRadius: 99,
                  background: "var(--cf-cta-gradient)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsModal() {
  const { settingsOpen, settingsPane, openSettings, closeSettings } =
    useShell();
  const { creator, user, logout } = useAuth();
  const [pane, setPane] = useState<SettingsPane>(settingsPane);
  useEffect(() => {
    if (settingsOpen) setPane(settingsPane);
  }, [settingsOpen, settingsPane]);
  if (!settingsOpen) return null;
  const email =
    (user as { email?: { address?: string } } | null)?.email?.address ?? "";

  return (
    <div className="modal-scrim" onClick={closeSettings}>
      <div
        className="settings-modal glass"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-side">
          <div
            className="settings-profile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "8px 10px 16px",
              borderBottom: "1px solid rgb(var(--ink) / 0.08)",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 99,
                background: "var(--cf-cta-gradient)",
                display: "grid",
                placeItems: "center",
                flex: "none",
              }}
            >
              <FrenBadge
                pose="mark"
                size={24}
                radius={99}
                bg="transparent"
                color="var(--cf-dark-blue)"
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {creator?.display_name ?? "Creator"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "rgb(var(--ink) / 0.5)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {email}
              </div>
            </div>
          </div>
          {NAV.map((n, i) =>
            n.sep ? (
              <div key={i} className="pop-sep" />
            ) : (
              <button
                key={n.k}
                className="settings-navitem"
                data-active={pane === n.k}
                onClick={() => openSettings(n.k)}
              >
                {Icon[n.icon!]({ size: 18 })}
                {n.label}
              </button>
            ),
          )}
          <div className="pop-sep" />
          <button
            className="settings-navitem"
            onClick={() => {
              closeSettings();
              void logout();
            }}
          >
            {Icon.logout({ size: 18 })}Log out
          </button>
        </div>
        <div className="settings-body">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 18,
            }}
          >
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
              {TITLES[pane]}
            </h2>
            <button
              className="icon-btn"
              onClick={closeSettings}
              style={{ width: 38, height: 38 }}
            >
              {Icon.back({ size: 18 })}
            </button>
          </div>
          {pane === "account" && <PaneAccount />}
          {pane === "subscription" && <PaneSubscription />}
          {pane === "wallet" && <WalletPane heading={false} />}
          {pane === "reports" && <ReportsPane heading={false} />}
          {pane === "connections" && <PaneConnections />}
          {pane === "channels" && <PaneChannels />}
          {pane === "appearance" && <PaneAppearance />}
          {pane === "referrals" && <PaneReferrals />}
          {pane === "usage" && <PaneUsage />}
        </div>
      </div>
    </div>
  );
}
