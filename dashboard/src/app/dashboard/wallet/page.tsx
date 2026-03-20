"use client";

import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { fetchTransactions, formatCurrency } from "@/lib/api";
import { useAuthedQuery } from "@/lib/use-authed-query";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

export default function WalletPage() {
  const { data: transactions, error, isLoading } = useAuthedQuery(fetchTransactions, []);
  const { user } = usePrivy();
  const totalSpent = transactions.reduce((sum, tx) => sum + tx.amount_cents, 0);

  // Show funding banner if no transactions yet (implying zero balance)
  const showFundingBanner = transactions.length === 0 && !isLoading;

  return (
    <DashboardAuthGate>
      <div className="space-y-6">
        {showFundingBanner && (
          <div className="rounded-[28px] border border-moss/20 bg-moss/10 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-moss">Fund Your Agent Wallet</h3>
                <p className="mt-2 text-sm leading-7 text-ink/80">
                  Your AI agent needs pathUSD on Tempo Network to pay for premium services like brand research, email sending, and content generation.
                </p>
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-ink/70">
                    <strong>Your Wallet Address:</strong>
                  </p>
                  <code className="block rounded-lg bg-white/50 px-3 py-2 text-xs font-mono text-ink">
                    {user?.wallet?.address || "Not yet provisioned"}
                  </code>
                  <p className="text-xs text-ink/60 mt-2">
                    Copy this address and use the{" "}
                    <Link href="/docs/wallet-funding" className="underline">
                      wallet funding guide
                    </Link>{" "}
                    to add testnet pathUSD.
                  </p>
                </div>
                <div className="mt-4">
                  <a
                    href="https://faucet.tempo.xyz"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-lg bg-moss px-4 py-2 text-sm font-semibold text-white hover:bg-moss/90"
                  >
                    Get Testnet Funds →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
        <article className="paper-panel rounded-card border border-black/10 p-6">
          <p className="eyebrow text-[11px] text-fog">Wallet overview</p>
          <h2 className="display-title mt-3 text-4xl leading-none text-ink">Every agent action leaves a receipt.</h2>
          <p className="mt-4 text-sm leading-7 text-fog">
            Privy policy-backed wallets handle execution. The dashboard keeps a readable trail
            of credits, paid calls, and spend velocity.
          </p>
        </article>

        <article className="rounded-[28px] border border-black/10 bg-ink p-6 text-paper shadow-card">
          <p className="eyebrow text-[11px] text-paper/55">Spent so far</p>
          <p className="mt-4 text-6xl font-semibold">{formatCurrency(totalSpent)}</p>
          <p className="mt-4 text-sm leading-7 text-paper/72">
            {transactions.length === 0
              ? "No wallet activity yet. Once the agent starts paying for research or enrichment, entries will appear here."
              : `${transactions.length} transaction${transactions.length === 1 ? "" : "s"} recorded for this creator.`}
          </p>
        </article>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-white/75 p-6 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow text-[11px] text-fog">Recent transactions</p>
            <h3 className="display-title mt-2 text-3xl text-ink">Spend ledger</h3>
          </div>
          <p className="text-sm text-fog">{transactions.length} entries</p>
        </div>
        {error ? (
          <p className="mt-4 rounded-[18px] border border-blush/20 bg-blush/10 px-4 py-3 text-sm text-ink">
            {error}
          </p>
        ) : null}

        <div className="mt-6 space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="grid gap-3 rounded-[22px] border border-black/10 bg-parchment p-4 md:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="text-base font-semibold text-ink">{transaction.description}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-fog">
                  {transaction.type}
                  {transaction.service ? ` • ${transaction.service}` : ""}
                </p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-lg font-semibold text-plum">
                  {formatCurrency(transaction.amount_cents)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-fog">
                  {new Date(transaction.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}

          {transactions.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-black/10 p-4 text-sm leading-7 text-fog">
              {isLoading
                ? "Loading the latest wallet entries..."
                : "No wallet activity has been logged for this creator yet."}
            </div>
          ) : null}
        </div>
        </section>
      </div>
    </DashboardAuthGate>
  );
}
