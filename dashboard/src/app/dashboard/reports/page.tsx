"use client";

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
        <div style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: 24 }}>
        <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Business snapshot</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>
          {financial ? financial.period : isLoading ? "Loading..." : "—"}
        </h2>
        {error ? (
          <p className="mt-4 rounded-[18px] px-4 py-3 text-sm" style={{ border: "1px solid var(--accent-pink-border)", background: "var(--accent-pink-bg)", color: "var(--text-primary)" }}>
            {error}
          </p>
        ) : null}

        {financial ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat label="Income" value={formatCurrency(financial.income.totalCents)} />
            <Stat label="Expenses" value={formatCurrency(financial.expenses.totalCents)} />
            <Stat label="Net" value={formatCurrency(financial.netCents)} />
            <Stat label="Pipeline Deals" value={String(financial.pipeline.activeDealCount)} />
            <Stat label="Pipeline Value" value={formatCurrency(financial.pipeline.totalPipelineValueCents)} />
            <Stat
              label="Forecast"
              value={`${formatCurrency(financial.forecast.nextMonthEstimateCents)}/mo`}
              sub={financial.forecast.confidence}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm" style={{ color: "var(--text-tertiary)" }}>
            No financial data yet. Reports will populate once you have deals and transactions.
          </p>
        )}
      </div>

      <div style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: 24 }}>
        <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Audience growth</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: "var(--text-primary)" }}>
          {analytics
            ? `${formatDashboardNumber(analytics.totalFollowers)} total followers`
            : isLoading
              ? "Loading..."
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
                    <span className="text-red-500">{p.error}</span>
                  ) : (
                    <>
                      <span className="font-semibold">
                        {p.followers != null ? formatDashboardNumber(p.followers) : "—"}
                      </span>
                      {p.engagementRate != null && (
                        <span className="ml-2" style={{ color: "var(--text-tertiary)" }}>{(p.engagementRate * 100).toFixed(1)}% eng.</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm" style={{ color: "var(--text-tertiary)" }}>
            No platforms connected yet. Connect your social accounts in Settings to see audience data here.
          </p>
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
      {sub && <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{sub}</p>}
    </div>
  );
}
