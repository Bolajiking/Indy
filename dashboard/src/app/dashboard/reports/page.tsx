"use client";

import Link from "next/link";
import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import {
  fetchAnalytics,
  fetchFinancial,
  formatCurrency,
} from "@/lib/api";
import { formatDashboardNumber } from "@/lib/datetime";
import { useAuthedQuery } from "@/lib/use-authed-query";

export default function ReportsPage() {
  const {
    data: financial,
    error: financialError,
    isLoading: financialLoading,
  } = useAuthedQuery(fetchFinancial, null);
  const {
    data: analytics,
    error: analyticsError,
    isLoading: analyticsLoading,
  } = useAuthedQuery(fetchAnalytics, null);
  const error = financialError ?? analyticsError;
  const isLoading = financialLoading || analyticsLoading;

  return (
    <DashboardAuthGate>
      <div className="space-y-6">
        <section style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "24px 32px" }}>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Reports</p>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 12, lineHeight: 1, color: "var(--text-primary)" }}>
            Your business at a glance
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
            Revenue, audience growth, and deal pipeline — all in one place.
            Connect your social platforms to unlock full analytics.
          </p>
          {error ? (
            <p className="mt-4 rounded-[18px] px-4 py-3 text-sm" style={{ border: "1px solid var(--accent-pink-border)", background: "var(--accent-pink-bg)", color: "var(--text-primary)" }}>
              {error}
            </p>
          ) : null}
        </section>

        <div style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: 24 }}>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Revenue</p>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>
            {financial ? financial.period : isLoading ? "Loading…" : "—"}
          </h2>

          {financial ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Stat label="Income" value={formatCurrency(financial.income.totalCents)} />
              <Stat label="Expenses" value={formatCurrency(financial.expenses.totalCents)} />
              <Stat label="Net" value={formatCurrency(financial.netCents)} />
              <Stat label="Active deals" value={String(financial.pipeline.activeDealCount)} />
              <Stat label="Pipeline value" value={formatCurrency(financial.pipeline.totalPipelineValueCents)} />
              <Stat
                label="Monthly forecast"
                value={`${formatCurrency(financial.forecast.nextMonthEstimateCents)}/mo`}
                sub={financial.forecast.confidence}
              />
            </div>
          ) : isLoading ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-xl p-4 shimmer" style={{ height: 72, border: "1px solid var(--border-default)" }} />
              ))}
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-start gap-4">
              <p className="text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
                Revenue data will appear here once you have active deals and transactions. Close your first brand deal to see your numbers.
              </p>
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "var(--accent-blue)", borderRadius: "var(--radius-button)", padding: "10px 20px" }}
              >
                Scan for brand deals
              </Link>
            </div>
          )}
        </div>

        <div style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: 24 }}>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Audience</p>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>
            {analytics
              ? `${formatDashboardNumber(analytics.totalFollowers)} followers`
              : isLoading
                ? "Loading…"
                : "—"}
          </h2>

          {analytics && analytics.platforms.length > 0 ? (
            <div className="mt-4 space-y-2">
              {analytics.platforms.map((p) => (
                <div key={p.platform} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ border: "1px solid var(--border-default)" }}>
                  <div>
                    <span className="font-semibold capitalize" style={{ color: "var(--text-primary)" }}>{p.platform}</span>
                    <span className="ml-2 text-sm" style={{ color: "var(--text-tertiary)" }}>@{p.username}</span>
                  </div>
                  <div className="text-right text-sm">
                    {p.error ? (
                      <span style={{ color: "var(--accent-pink)" }}>Sync error — reconnect in Settings</span>
                    ) : (
                      <>
                        <span className="font-semibold">
                          {p.followers != null ? formatDashboardNumber(p.followers) : "—"}
                        </span>
                        {p.engagementRate != null && (
                          <span className="ml-2" style={{ color: "var(--text-tertiary)" }}>{(p.engagementRate * 100).toFixed(1)}% engagement</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : isLoading ? (
            <div className="mt-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-xl shimmer" style={{ height: 52, border: "1px solid var(--border-default)" }} />
              ))}
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-start gap-4">
              <p className="text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
                Connect your Instagram, TikTok, YouTube, or other platforms to see follower counts and engagement data here. This helps Indyfren calculate accurate rates for brand deals.
              </p>
              <Link
                href="/dashboard/settings"
                className="text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "var(--accent-pink)", borderRadius: "var(--radius-button)", padding: "10px 20px" }}
              >
                Connect a platform
              </Link>
            </div>
          )}
        </div>
      </div>
    </DashboardAuthGate>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ border: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
      <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{label}</p>
      <p className="mt-1 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{sub}</p>}
    </div>
  );
}
