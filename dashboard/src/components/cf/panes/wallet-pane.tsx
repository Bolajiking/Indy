"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Notice, StatusBadge, EmptyState } from "@/components/cf/ui";
import { Icon } from "@/components/cf/primitives";
import {
  fetchPaymentAttempts,
  fetchTransactions,
  fetchWalletBalance,
  formatCurrency,
  type DashboardPaymentAttempt,
  type DashboardTransaction,
  type DashboardWalletBalance,
} from "@/lib/api";
import { formatDashboardDate } from "@/lib/datetime";
import { useAuthedQuery } from "@/lib/use-authed-query";
import { useAuth } from "@/lib/auth-context";

const EMPTY_BALANCE: DashboardWalletBalance = {
  balanceCents: 0,
  balanceFormatted: "$0.00",
  walletAddress: null,
};

function txStatus(t: DashboardTransaction): "settled" | "pending" | "failed" {
  if (t.status === "failed") return "failed";
  if (t.status === "pending") return "pending";
  return "settled";
}

function paymentAttemptTone(
  status: DashboardPaymentAttempt["status"],
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "succeeded") return "success";
  if (status === "failed") return "danger";
  if (status === "started" || status === "challenge_created") return "warning";
  if (status === "credential_created") return "info";
  return "neutral";
}

function paymentAttemptLabel(status: DashboardPaymentAttempt["status"]) {
  return status.replaceAll("_", " ");
}

export function WalletPane({ heading = true }: { heading?: boolean }) {
  const { creator, onboarding, updateProfile, syncing } = useAuth();
  const { data: txns, isLoading } = useAuthedQuery(
    fetchTransactions,
    [],
    "indyfren_txns_v1",
  );
  const { data: attempts, isLoading: attemptsLoading } = useAuthedQuery(
    fetchPaymentAttempts,
    [],
    "indyfren_payment_attempts_v1",
  );
  const { data: balance, isLoading: balanceLoading } = useAuthedQuery(
    fetchWalletBalance,
    EMPTY_BALANCE,
    "indyfren_balance_v1",
  );
  const [copied, setCopied] = useState(false);

  // editable spending limits live here (design: limits sit in the Wallet surface)
  const [editing, setEditing] = useState(false);
  const [perTx, setPerTx] = useState("5.00");
  const [daily, setDaily] = useState("50.00");
  const [monthly, setMonthly] = useState("500.00");
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  useEffect(() => {
    const l = creator?.settings?.spending_limits as
      | {
          per_transaction_cents?: number;
          daily_cents?: number;
          monthly_cents?: number;
        }
      | undefined;
    setPerTx(((l?.per_transaction_cents ?? 500) / 100).toFixed(2));
    setDaily(((l?.daily_cents ?? 5000) / 100).toFixed(2));
    setMonthly(((l?.monthly_cents ?? 50000) / 100).toFixed(2));
  }, [creator?.settings]);

  const copy = useCallback(() => {
    if (!balance.walletAddress) return;
    void navigator.clipboard.writeText(balance.walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [balance.walletAddress]);

  const spent = useMemo(
    () =>
      txns.reduce(
        (s, t) => (t.type === "credit" ? s : s + Math.abs(t.amount_cents)),
        0,
      ),
    [txns],
  );
  const lowBalance =
    !balanceLoading &&
    (balance.lowBalance ??
      balance.balanceCents < (balance.minimumRecommendedBalanceCents ?? 500));
  const addr = balance.walletAddress;
  const shortAddr = addr
    ? `${addr.slice(0, 6)}…${addr.slice(-4)}`
    : "Setting up…";

  async function saveLimits() {
    setLimitMsg(null);
    const toCents = (v: string) => Math.round(Number.parseFloat(v) * 100);
    const p = toCents(perTx),
      d = toCents(daily),
      m = toCents(monthly);
    if (![p, d, m].every((n) => Number.isFinite(n) && n > 0)) {
      setLimitMsg("Enter positive dollar amounts.");
      return;
    }
    try {
      await updateProfile({
        settings: {
          spending_limits: {
            ...((creator?.settings?.spending_limits as Record<
              string,
              unknown
            >) ?? {}),
            per_transaction_cents: p,
            daily_cents: d,
            monthly_cents: m,
          },
        },
      });
      setLimitMsg("Saved.");
      setEditing(false);
    } catch {
      setLimitMsg("Couldn't save. Try again.");
    }
  }

  const limits =
    (creator?.settings?.spending_limits as
      | {
          per_transaction_cents?: number;
          daily_cents?: number;
          monthly_cents?: number;
        }
      | undefined) ?? {};

  return (
    <div>
      {heading && (
        <div style={{ marginBottom: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Wallet &amp; trust
          </div>
          <h1 className="h-title" style={{ fontSize: 28 }}>
            Money you control
          </h1>
        </div>
      )}

      {onboarding.walletProvisioningInProgress && (
        <Notice
          tone="info"
          title="Wallet finishing setup"
          style={{ marginBottom: 16 }}
        >
          Your sandbox wallet is provisioning in the background. Paid actions
          unlock the moment it&apos;s ready.
        </Notice>
      )}
      {lowBalance && (
        <Notice tone="warning" title="Low balance" style={{ marginBottom: 16 }}>
          Your sandbox wallet is below{" "}
          {formatCurrency(balance.minimumRecommendedBalanceCents ?? 500)}. Top
          up testnet pathUSD before approving paid research, outreach, or
          contract reviews.
        </Notice>
      )}

      <div
        style={{ display: "flex", gap: 14, marginBottom: 18, flexWrap: "wrap" }}
      >
        <div
          className="gcard"
          style={{
            flex: "1 1 300px",
            padding: 24,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -40,
              top: -40,
              width: 180,
              height: 180,
              borderRadius: 99,
              background:
                "radial-gradient(closest-side, rgba(64,255,204,0.22), transparent)",
            }}
          />
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Available balance
          </div>
          <div
            style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.03em" }}
          >
            {balanceLoading ? "—" : balance.balanceFormatted}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgb(var(--ink) / 0.5)",
              marginTop: 6,
              maxWidth: 320,
            }}
          >
            Funds Indyfren spends on your behalf — research, emails, reviews. No
            crypto wallet to manage.
          </div>
          {addr && (
            <button
              className="dark-pill dark-pill--solid"
              style={{ marginTop: 16 }}
              onClick={copy}
            >
              {copied ? "Address copied" : "Copy wallet address"}
            </button>
          )}
        </div>
        <div className="gcard" style={{ flex: "1 1 220px", padding: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Spent this month
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--cf-cyan)",
            }}
          >
            {formatCurrency(spent)}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgb(var(--ink) / 0.5)",
              marginTop: 6,
            }}
          >
            Across {txns.length} agent action{txns.length === 1 ? "" : "s"}.
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              color: "rgb(var(--ink) / 0.6)",
              background: "rgb(var(--ink) / 0.05)",
              padding: "9px 12px",
              borderRadius: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid rgb(var(--ink) / 0.07)",
            }}
          >
            <span>{shortAddr}</span>
            {addr && (
              <button
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--cf-accent-blue)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  background: "none",
                  border: "none",
                }}
                onClick={copy}
              >
                {Icon.copy({ size: 13, color: "var(--cf-accent-blue)" })}{" "}
                {copied ? "COPIED" : "COPY"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="gcard" style={{ padding: 24, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            marginBottom: 6,
            flexWrap: "wrap",
          }}
        >
          {Icon.wallet({ size: 20, color: "var(--cf-accent-blue)" })}
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            Sandbox funding
          </h3>
          <StatusBadge tone="info">Tempo testnet</StatusBadge>
        </div>
        <p
          style={{
            fontSize: 13.5,
            color: "rgb(var(--ink) / 0.62)",
            margin: "0 0 16px",
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          {balance.fundingInstructions?.description ??
            "You're in sandbox mode — top up with free test funds to try paid features. Real money never moves here."}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            ["Network", balance.network?.name ?? "Tempo Testnet (Moderato)"],
            ["Token", balance.network?.currency ?? "pathUSD"],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                flex: "1 1 150px",
                minWidth: 140,
                background: "rgb(var(--ink) / 0.04)",
                border: "1px solid rgb(var(--ink) / 0.07)",
                borderRadius: 14,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  color: "rgb(var(--ink) / 0.48)",
                  marginBottom: 4,
                }}
              >
                {label}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* spending controls — editable */}
      <div className="gcard" style={{ padding: 24, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            marginBottom: 5,
            flexWrap: "wrap",
          }}
        >
          {Icon.shield({ size: 20, color: "var(--cf-grad-end)" })}
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            Spending controls
          </h3>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--cf-grad-end)",
              background: "rgba(64,255,204,0.12)",
              padding: "4px 9px",
              borderRadius: 99,
            }}
          >
            Enforced
          </span>
          <div style={{ flex: 1 }} />
          {!editing && (
            <button
              className="dark-pill"
              style={{ height: 36 }}
              onClick={() => setEditing(true)}
            >
              Adjust
            </button>
          )}
        </div>
        <p
          style={{
            fontSize: 13.5,
            color: "rgb(var(--ink) / 0.6)",
            margin: "0 0 18px",
          }}
        >
          Hard limits Indyfren can never cross. You&apos;re always in control.
        </p>
        {editing ? (
          <>
            <div className="field-group" style={{ marginBottom: 14 }}>
              <div className="field-row">
                <label>Per-action</label>
                <span style={{ color: "rgb(var(--ink) / 0.6)" }}>
                  $
                  <input
                    value={perTx}
                    onChange={(e) => setPerTx(e.target.value)}
                    inputMode="decimal"
                    style={{ width: 80 }}
                  />
                </span>
              </div>
              <div className="field-row">
                <label>Daily</label>
                <span style={{ color: "rgb(var(--ink) / 0.6)" }}>
                  $
                  <input
                    value={daily}
                    onChange={(e) => setDaily(e.target.value)}
                    inputMode="decimal"
                    style={{ width: 80 }}
                  />
                </span>
              </div>
              <div className="field-row">
                <label>Monthly</label>
                <span style={{ color: "rgb(var(--ink) / 0.6)" }}>
                  $
                  <input
                    value={monthly}
                    onChange={(e) => setMonthly(e.target.value)}
                    inputMode="decimal"
                    style={{ width: 80 }}
                  />
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="dark-pill dark-pill--solid"
                style={{ height: 38 }}
                disabled={syncing}
                onClick={() => void saveLimits()}
              >
                {syncing ? "Saving…" : "Save limits"}
              </button>
              <button
                className="dark-pill"
                style={{ height: 38 }}
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              {limitMsg && (
                <span style={{ fontSize: 13, color: "rgb(var(--ink) / 0.6)" }}>
                  {limitMsg}
                </span>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {[
              ["Per action", limits.per_transaction_cents ?? 500],
              ["Daily", limits.daily_cents ?? 5000],
              ["Monthly", limits.monthly_cents ?? 50000],
            ].map(([l, v]) => (
              <div
                key={l as string}
                style={{
                  flex: 1,
                  minWidth: 130,
                  background: "rgb(var(--ink) / 0.04)",
                  border: "1px solid rgb(var(--ink) / 0.07)",
                  borderRadius: 14,
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "rgb(var(--ink) / 0.5)",
                    marginBottom: 4,
                  }}
                >
                  {l as string} limit
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  {formatCurrency(v as number)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="gcard" style={{ padding: 8, marginBottom: 18 }}>
        <div style={{ padding: "14px 16px 10px" }} className="eyebrow">
          Agent payments
        </div>
        {attempts.map((attempt) => (
          <div
            key={attempt.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "13px 16px",
              borderTop: "1px solid rgb(var(--ink) / 0.06)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgb(var(--ink) / 0.06)",
                display: "grid",
                placeItems: "center",
                flex: "none",
              }}
            >
              {Icon.bolt({
                size: 16,
                color:
                  attempt.status === "failed"
                    ? "var(--cf-coral)"
                    : "rgb(var(--ink) / 0.7)",
              })}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                {attempt.service_host}
              </div>
              <div style={{ fontSize: 12.5, color: "rgb(var(--ink) / 0.45)" }}>
                {attempt.method ? `${attempt.method} · ` : ""}
                {attempt.intent ? `${attempt.intent} · ` : ""}
                {formatDashboardDate(attempt.created_at)}
              </div>
              {attempt.receipt_reference && (
                <div
                  style={{
                    fontSize: 12,
                    color: "rgb(var(--ink) / 0.52)",
                    marginTop: 2,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  receipt {attempt.receipt_reference.slice(0, 18)}
                  {attempt.receipt_reference.length > 18 ? "…" : ""}
                </div>
              )}
              {attempt.error && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--cf-coral)",
                    marginTop: 2,
                  }}
                >
                  {attempt.error}
                </div>
              )}
            </div>
            <StatusBadge tone={paymentAttemptTone(attempt.status)}>
              {paymentAttemptLabel(attempt.status)}
            </StatusBadge>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                minWidth: 72,
                textAlign: "right",
                color:
                  attempt.status === "failed"
                    ? "rgb(var(--ink) / 0.5)"
                    : "rgb(var(--ink))",
              }}
            >
              {formatCurrency(
                attempt.actual_amount_cents ?? attempt.quoted_amount_cents ?? 0,
              )}
            </div>
          </div>
        ))}
        {attempts.length === 0 && (
          <div style={{ padding: 18 }}>
            <EmptyState
              title={
                attemptsLoading ? "Loading payments…" : "No agent payments yet"
              }
              detail={
                attemptsLoading
                  ? undefined
                  : "Every payment your agent makes — with its receipt — shows up here."
              }
            />
          </div>
        )}
      </div>

      {/* ledger */}
      <div className="gcard" style={{ padding: 8 }}>
        <div style={{ padding: "14px 16px 10px" }} className="eyebrow">
          Activity
        </div>
        {txns.map((t) => {
          const status = txStatus(t);
          const credit = t.type === "credit";
          return (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "13px 16px",
                borderTop: "1px solid rgb(var(--ink) / 0.06)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgb(var(--ink) / 0.06)",
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                }}
              >
                {Icon.bolt({
                  size: 16,
                  color: credit
                    ? "var(--cf-grad-end)"
                    : "rgb(var(--ink) / 0.7)",
                })}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                  {t.description}
                </div>
                <div
                  style={{ fontSize: 12.5, color: "rgb(var(--ink) / 0.45)" }}
                >
                  {t.service ? `${t.service} · ` : ""}
                  {formatDashboardDate(t.created_at)}
                </div>
                {t.error && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--cf-coral)",
                      marginTop: 2,
                    }}
                  >
                    {t.error}
                  </div>
                )}
              </div>
              <StatusBadge
                tone={
                  status === "failed"
                    ? "danger"
                    : status === "pending"
                      ? "warning"
                      : "success"
                }
              >
                {status}
              </StatusBadge>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  minWidth: 64,
                  textAlign: "right",
                  color: credit
                    ? "var(--cf-grad-end)"
                    : status === "failed"
                      ? "rgb(var(--ink) / 0.5)"
                      : "rgb(var(--ink))",
                }}
              >
                {credit ? "+" : "-"}
                {formatCurrency(Math.abs(t.amount_cents))}
              </div>
            </div>
          );
        })}
        {txns.length === 0 && (
          <div style={{ padding: 18 }}>
            <EmptyState
              title={isLoading ? "Loading activity…" : "No transactions yet"}
              detail={
                isLoading
                  ? undefined
                  : "Agent spend will appear here as Indyfren works for you."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
