"use client";

import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { DEAL_STAGE_ORDER, fetchDeals, formatCurrency } from "@/lib/api";
import { useAuthedQuery } from "@/lib/use-authed-query";

export default function DealsPage() {
  const { data: deals, error, isLoading } = useAuthedQuery(fetchDeals, []);

  return (
    <DashboardAuthGate>
      <div className="space-y-6">
        <section style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "24px 32px" }}>
        <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Deal pipeline</p>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 12, lineHeight: 1, color: "var(--text-primary)" }}>Every conversation, staged like a sales floor.</h2>
        <p className="mt-4 max-w-3xl text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
          Sponsor opportunities are grouped by momentum, so it&apos;s obvious what needs a pitch,
          what needs follow-up, and what is already moving money.
        </p>
        {error ? (
          <p className="mt-4 rounded-[18px] px-4 py-3 text-sm" style={{ border: "1px solid var(--accent-pink-border)", background: "var(--accent-pink-bg)", color: "var(--text-primary)" }}>
            {error}
          </p>
        ) : null}
      </section>

        <section className="grid gap-4 xl:grid-cols-4">
        {DEAL_STAGE_ORDER.map((stage) => {
          const stageDeals = deals.filter((deal) => deal.stage === stage);

          return (
            <article
              key={stage}
              style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-canvas)", padding: 20 }}
            >
              <div className="flex items-center justify-between">
                <h3 style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{stage}</h3>
                <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--accent-blue)", color: "white" }}>
                  {stageDeals.length}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--border-default)", background: "var(--bg-input)", padding: 16 }}
                  >
                    <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{deal.brand_name}</p>
                    <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>
                      {formatCurrency(deal.estimated_value_cents ?? 0)} estimated
                    </p>
                    <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-primary)", opacity: 0.78 }}>
                      Fit score {deal.fit_score ?? "n/a"}
                      {deal.notes ? ` • ${deal.notes}` : ""}
                    </p>
                  </div>
                ))}

                {stageDeals.length === 0 ? (
                  <div className="border border-dashed p-4 text-sm leading-7" style={{ borderRadius: "var(--radius-card)", borderColor: "var(--border-default)", color: "var(--text-tertiary)" }}>
                    {isLoading
                      ? "Loading the latest deals for this stage..."
                      : "No deals in this lane yet for this creator."}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
        </section>
      </div>
    </DashboardAuthGate>
  );
}
