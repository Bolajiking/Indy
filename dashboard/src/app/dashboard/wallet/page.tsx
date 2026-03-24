"use client";

import { useMemo, useState, useCallback } from "react";
import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { fetchTransactions, fetchWalletBalance, formatCurrency, type DashboardWalletBalance } from "@/lib/api";
import { formatDashboardDate } from "@/lib/datetime";
import { useAuthedQuery } from "@/lib/use-authed-query";

const EMPTY_BALANCE: DashboardWalletBalance = { balanceCents: 0, balanceFormatted: "$0.00", walletAddress: null };

export default function WalletPage() {
  const { data: transactions, error, isLoading } = useAuthedQuery(fetchTransactions, [], "indyfren_txns_v1");
  const { data: balance, isLoading: balanceLoading } = useAuthedQuery(fetchWalletBalance, EMPTY_BALANCE, "indyfren_balance_v1");
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(() => {
    if (!balance.walletAddress) return;
    void navigator.clipboard.writeText(balance.walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [balance.walletAddress]);

  const totalSpent = useMemo(
    () => transactions.reduce((sum, tx) => sum + tx.amount_cents, 0),
    [transactions]
  );

  // Show funding banner if wallet has no balance and no transactions yet
  const showFundingBanner = balance.balanceCents === 0 && transactions.length === 0 && !isLoading && !balanceLoading;

  return (
    <DashboardAuthGate>
      <div className="space-y-6">
        {/* Page header */}
        <section style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "24px 32px" }}>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Wallet</p>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 12, lineHeight: 1, color: "var(--text-primary)" }}>Your creator wallet</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
            Indyfren uses your wallet to pay for actions on your behalf — brand research,
            email outreach, contract analysis. Every transaction is logged here in real time.
          </p>
        </section>

        {showFundingBanner && (
          <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--gradient-approval)", padding: 24, color: "white" }}>
            <h3 className="text-lg font-semibold">Add funds to unlock paid actions</h3>
            <p className="mt-2 text-sm leading-7" style={{ color: "rgba(255,255,255,0.72)" }}>
              Your wallet is set up and ready. Add USDC to let Indyfren start working
              on brand research, outreach, and contract reviews on your behalf.
            </p>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>Your wallet address</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg px-3 py-2 text-xs font-mono break-all" style={{ background: "rgba(255,255,255,0.1)", color: "white" }}>
                  {balance.walletAddress || "Setting up your wallet…"}
                </code>
                {balance.walletAddress ? (
                  <button
                    onClick={copyAddress}
                    className="shrink-0 rounded px-2 py-1 text-xs font-medium transition hover:opacity-80"
                    style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "1px solid rgba(255,255,255,0.3)" }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                ) : null}
              </div>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                Send USDC to this address. Balance updates automatically within a few minutes.
              </p>
            </div>
          </div>
        )}

        {/* Balance + address */}
        <section className="grid gap-4 md:grid-cols-3">
          <article style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--accent-green-bg)", padding: 24 }}>
            <p style={{ fontSize: 11, color: "var(--accent-green-text)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Balance</p>
            <p className="mt-3 font-semibold" style={{ fontSize: 40, lineHeight: 1, color: "var(--accent-green-text)" }}>
              {balanceLoading ? "—" : balance.balanceFormatted}
            </p>
            <p className="mt-2 text-xs" style={{ color: "var(--text-tertiary)" }}>
              {balanceLoading ? "Fetching balance…" : balance.error ? "Could not fetch balance" : "Available to spend"}
            </p>
          </article>

          <article className="md:col-span-2" style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: 24 }}>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Wallet address</p>
            <div className="mt-3 flex items-start gap-2">
              <code className="flex-1 break-all text-xs font-mono leading-6" style={{ color: "var(--text-primary)" }}>
                {balance.walletAddress ?? "Setting up your wallet…"}
              </code>
              {balance.walletAddress ? (
                <button
                  onClick={copyAddress}
                  className="shrink-0 rounded px-2 py-1 text-xs font-medium transition hover:opacity-80"
                  style={{
                    background: copied ? "var(--accent-green-bg)" : "var(--bg-input)",
                    color: copied ? "var(--accent-green-text)" : "var(--text-secondary)",
                    border: "1px solid var(--border-default)",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              ) : null}
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
              Send USDC to this address to top up your Indyfren wallet.
            </p>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
          <article style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: 24 }}>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Spending</p>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 12, lineHeight: 1, color: "var(--text-primary)" }}>Agent spend log</h2>
            <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
              Every paid action Indyfren takes on your behalf is recorded here —
              brand research, email sends, contract reviews, and more.
            </p>
          </article>

          <article style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--accent-blue)", padding: 24, color: "white" }}>
            <p style={{ fontSize: 11, color: "white", opacity: 0.55 }}>Total spent</p>
            <p className="mt-4 text-6xl font-semibold">{formatCurrency(totalSpent)}</p>
            <p className="mt-4 text-sm leading-7" style={{ color: "white", opacity: 0.72 }}>
              {transactions.length === 0
                ? "No spending yet. Transactions will appear here once Indyfren starts working for you."
                : `${transactions.length} transaction${transactions.length === 1 ? "" : "s"} recorded.`}
            </p>
          </article>
        </section>

        <section style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-canvas)", padding: 24 }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Transaction history</p>
              <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>Activity</h3>
            </div>
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{transactions.length} {transactions.length === 1 ? "entry" : "entries"}</p>
          </div>
          {error ? (
            <p className="mt-4 rounded-[18px] px-4 py-3 text-sm" style={{ border: "1px solid var(--accent-pink-border)", background: "var(--accent-pink-bg)", color: "var(--text-primary)" }}>
              {error}
            </p>
          ) : null}

          <div className="mt-6 space-y-3">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid gap-3 md:grid-cols-[1fr_auto]"
                style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-input)", padding: 16 }}
              >
                <div>
                  <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{transaction.description}</p>
                  <p className="mt-1 text-xs capitalize" style={{ color: "var(--text-tertiary)" }}>
                    {transaction.type}
                    {transaction.service ? ` · ${transaction.service}` : ""}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p
                    className="text-lg font-semibold"
                    style={{
                      color: transaction.type === "credit"
                        ? "var(--accent-green-text)"
                        : "var(--accent-pink)",
                    }}
                  >
                    {transaction.type === "credit" ? "+" : "-"}
                    {formatCurrency(Math.abs(transaction.amount_cents))}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {formatDashboardDate(transaction.created_at)}
                  </p>
                </div>
              </div>
            ))}

            {transactions.length === 0 ? (
              <div className="border border-dashed p-6 text-sm leading-7 text-center" style={{ borderRadius: "var(--radius-card)", borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}>
                {isLoading
                  ? "Loading your transactions…"
                  : "No transactions yet. Your activity will show up here as Indyfren works for you."}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </DashboardAuthGate>
  );
}
