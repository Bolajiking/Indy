"use client";

import { EmptyState } from "@/components/cf/ui";
import { BrandGlyph } from "@/components/cf/primitives";
import { fetchAnalytics, fetchFinancial, formatCurrency } from "@/lib/api";
import { formatDashboardNumber } from "@/lib/datetime";
import { useAuthedQuery } from "@/lib/use-authed-query";
import { useShell } from "@/components/cf/shell-context";

export function ReportsPane({ heading = true }: { heading?: boolean }) {
  const { data: financial, isLoading: finLoading } = useAuthedQuery(
    fetchFinancial,
    null,
    "indyfren_financial_v1",
  );
  const { data: analytics, isLoading: anaLoading } = useAuthedQuery(
    fetchAnalytics,
    null,
    "indyfren_analytics_v1",
  );
  const shell = useShell();

  const revenue = financial
    ? [
        {
          l: "Income",
          v: formatCurrency(financial.income.totalCents),
          c: "var(--cf-grad-end)",
        },
        {
          l: "Agent spend",
          v: formatCurrency(financial.expenses.totalCents),
          c: "rgb(var(--ink))",
        },
        {
          l: "Net",
          v: formatCurrency(financial.netCents),
          c: "rgb(var(--ink))",
        },
        {
          l: "Active deals",
          v: String(financial.pipeline.activeDealCount),
          c: "var(--cf-cyan)",
        },
        {
          l: "Pipeline value",
          v: formatCurrency(financial.pipeline.totalPipelineValueCents),
          c: "rgb(var(--ink))",
        },
        {
          l: "Monthly forecast",
          v: formatCurrency(financial.forecast.nextMonthEstimateCents),
          c: "var(--cf-periwinkle)",
          sub: `${financial.forecast.confidence} confidence`,
        },
      ]
    : [];

  return (
    <div>
      {heading && (
        <div style={{ marginBottom: 22 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Reports
          </div>
          <h1 className="h-title" style={{ fontSize: 28 }}>
            The numbers, clearly
          </h1>
        </div>
      )}

      <div className="gcard" style={{ padding: 24, marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 18,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Revenue</h3>
          <span style={{ fontSize: 13, color: "rgb(var(--ink) / 0.45)" }}>
            {financial ? financial.period : finLoading ? "Loading…" : "—"}
          </span>
        </div>
        {financial ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            {revenue.map((s) => (
              <div
                key={s.l}
                style={{
                  background: "rgb(var(--ink) / 0.04)",
                  border: "1px solid rgb(var(--ink) / 0.07)",
                  borderRadius: 16,
                  padding: "16px 18px",
                }}
              >
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  {s.l}
                </div>
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: s.c,
                  }}
                >
                  {s.v}
                </div>
                {s.sub && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgb(var(--ink) / 0.4)",
                      marginTop: 4,
                    }}
                  >
                    {s.sub}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : finLoading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="shimmer"
                style={{ height: 76, borderRadius: 16 }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No revenue yet"
            detail="Close your first brand deal to see income, net, and forecast here."
            action={
              <button
                className="dark-pill dark-pill--solid"
                onClick={() =>
                  shell.askAgent("Scan for brand deals that fit me")
                }
              >
                Scan for deals
              </button>
            }
          />
        )}
      </div>

      <div className="gcard" style={{ padding: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 18,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Audience</h3>
          <span style={{ fontSize: 13, color: "rgb(var(--ink) / 0.45)" }}>
            {analytics
              ? `${formatDashboardNumber(analytics.totalFollowers)} total followers`
              : anaLoading
                ? "Loading…"
                : "—"}
          </span>
        </div>
        {analytics && analytics.platforms.length > 0 ? (
          <div style={{ display: "grid", gap: 10 }}>
            {analytics.platforms.map((p) => (
              <div
                key={p.platform}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 4px",
                }}
              >
                <BrandGlyph
                  name={
                    p.platform.charAt(0).toUpperCase() + p.platform.slice(1)
                  }
                  size={38}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {p.platform}
                  </div>
                  <div
                    style={{ fontSize: 12.5, color: "rgb(var(--ink) / 0.45)" }}
                  >
                    {p.error
                      ? "Sync error — reconnect in Settings"
                      : `${p.followers != null ? formatDashboardNumber(p.followers) : "—"} followers`}
                  </div>
                </div>
                {!p.error && (
                  <>
                    <div style={{ width: 120, maxWidth: "30vw" }}>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 99,
                          background: "rgb(var(--ink) / 0.1)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, (p.engagementRate ?? 0) * 100 * 9)}%`,
                            height: "100%",
                            background: "var(--cf-cta-gradient)",
                            borderRadius: 99,
                          }}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        minWidth: 48,
                        textAlign: "right",
                        color: "var(--cf-grad-end)",
                      }}
                    >
                      {p.engagementRate != null
                        ? `${(p.engagementRate * 100).toFixed(1)}%`
                        : "—"}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : anaLoading ? (
          <div style={{ display: "grid", gap: 10 }}>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="shimmer"
                style={{ height: 52, borderRadius: 14 }}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Connect a platform"
            detail="Link Instagram, TikTok, or YouTube to see follower counts and engagement."
            action={
              <button
                className="dark-pill dark-pill--solid"
                onClick={() => shell.openSettings("connections")}
              >
                Connect a platform
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
