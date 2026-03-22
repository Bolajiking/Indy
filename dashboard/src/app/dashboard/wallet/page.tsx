"use client";

import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { fetchTransactions, formatCurrency } from "@/lib/api";
import { formatDashboardDate } from "@/lib/datetime";
import { useAuth } from "@/lib/privy";
import { useAuthedQuery } from "@/lib/use-authed-query";

export default function WalletPage() {
  const { data: transactions, error, isLoading } = useAuthedQuery(fetchTransactions, []);
  const { creator } = useAuth();
  const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount_cents, 0);

  // Show funding banner if no transactions yet (implying zero balance)
  const showFundingBanner = transactions.length === 0 && !isLoading;

  return (
    <DashboardAuthGate>
      <div className="space-y-6">
        {showFundingBanner && (
          <div style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--accent-green-border)", background: "var(--accent-green-bg)", padding: 24 }}>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold" style={{ color: "var(--accent-green-text)" }}>Fund your wallet</h3>
                <p className="mt-2 text-sm leading-7" style={{ color: "var(--text-primary)", opacity: 0.8 }}>
                  Indyfren needs funds to pay for services like brand research, email outreach, and content generation on your behalf.
                </p>
                <div className="mt-4 space-y-2">
                  <p className="text-sm" style={{ color: "var(--text-primary)", opacity: 0.7 }}>
                    <strong>Wallet address:</strong>
                  </p>
                  <code className="block rounded-lg px-3 py-2 text-xs font-mono" style={{ background: "white", opacity: 0.5, color: "var(--text-primary)" }}>
                    {creator?.wallet_address || "Setting up..."}
                  </code>
                  <p className="text-xs mt-2" style={{ color: "var(--text-primary)", opacity: 0.6 }}>
                    Copy this address and add Tempo testnet funds so Indyfren can start using
                    paid tools.
                  </p>
                </div>
                <div className="mt-4">
                  <a
                    href="https://faucet.tempo.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90"
                    style={{ background: "var(--accent-green-text)", color: "white" }}
                  >
                    Get Testnet Funds →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <article style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: 24 }}>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Wallet</p>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 12, lineHeight: 1, color: "var(--text-primary)" }}>Your spending at a glance</h2>
          <p className="mt-4 text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
            Every paid action Indyfren takes on your behalf is recorded here.
            Track what's been spent, which services were used, and how your budget is trending.
          </p>
        </article>

        <article style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--accent-blue)", padding: 24, color: "white" }}>
          <p style={{ fontSize: 11, color: "white", opacity: 0.55 }}>Total spent</p>
          <p className="mt-4 text-6xl font-semibold">{formatCurrency(totalSpent)}</p>
          <p className="mt-4 text-sm leading-7" style={{ color: "white", opacity: 0.72 }}>
            {transactions.length === 0
              ? "No spending yet. Transactions will appear here once Indyfren starts using paid tools."
              : `${transactions.length} transaction${transactions.length === 1 ? "" : "s"} so far.`}
          </p>
        </article>
        </section>

        <section style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-canvas)", padding: 24 }}>
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Recent transactions</p>
            <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>Activity</h3>
          </div>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>{transactions.length} entries</p>
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
                <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {transaction.type}
                  {transaction.service ? ` • ${transaction.service}` : ""}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-lg font-semibold" style={{ color: "var(--accent-pink)" }}>
                  {formatCurrency(transaction.amount_cents)}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {formatDashboardDate(transaction.created_at)}
                </p>
              </div>
            </div>
          ))}

          {transactions.length === 0 ? (
            <div className="border border-dashed p-4 text-sm leading-7" style={{ borderRadius: "var(--radius-card)", borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}>
              {isLoading
                ? "Loading recent transactions..."
                : "No transactions yet. Activity will show up here once Indyfren starts using paid tools."}
            </div>
          ) : null}
        </div>
        </section>
      </div>
    </DashboardAuthGate>
  );
}
