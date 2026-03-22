"use client";

import { AgentConsole } from "@/components/agent-console";
import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import {
  EMPTY_HOME_DATA,
  buildDashboardHomeModel,
  fetchDashboardHome,
  shouldHydrateAgentConsole,
} from "@/lib/dashboard-home";
import { useAuthedQuery } from "@/lib/use-authed-query";

export default function DashboardPage() {
  const { data, error, isLoading } = useAuthedQuery(fetchDashboardHome, EMPTY_HOME_DATA);
  const model = buildDashboardHomeModel(data);
  const shouldHydrate = shouldHydrateAgentConsole({ isLoading, error });

  return (
    <DashboardAuthGate>
      <div className="space-y-6">
        <section className="paper-panel rounded-card border border-black/10 p-6 md:p-8">
        <div className="grid gap-5 md:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-4">
            <p className="eyebrow text-[11px] text-fog">Overview</p>
            <h2 className="display-title text-4xl leading-none text-ink md:text-5xl">
              A calm command center for messy creator revenue.
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-fog">
              Morning briefs, sponsor opportunities, and wallet events settle into one
              readable desk. When a creator is selected, these cards pull directly from the
              backend routes already exposed by Indyfren.
            </p>
          </div>

          <div className="rounded-[28px] border border-black/10 bg-ink p-6 text-paper">
            <p className="eyebrow text-[11px] text-paper/55">Today</p>
            <p className="mt-3 text-2xl font-semibold">
              {isLoading ? "Syncing creator data" : model.todayHero.summary}
            </p>
            <p className="mt-3 text-sm leading-7 text-paper/72">
              {error
                ? error
                : isLoading
                  ? "Collecting creator, deal, wallet, and approval data from the dashboard API."
                  : model.status.detail}
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-paper/55">
              Approvals {model.todayHero.approvalsCount} · Follow-ups{" "}
              {model.todayHero.followUpsCount} · Wallet{" "}
              {model.todayHero.walletReady ? "ready" : "pending"}
            </p>
          </div>
          </div>
        </section>

        <AgentConsole
          initialState={shouldHydrate ? data.agentState : undefined}
          isHydrated={shouldHydrate}
        />

        <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[28px] border border-black/10 bg-white/70 p-6 shadow-card">
          <p className="eyebrow text-[11px] text-fog">Active deals</p>
          <p className="mt-3 text-5xl font-semibold text-moss">{model.stats.activeDealsCount}</p>
          <p className="mt-3 text-sm leading-7 text-fog">
            Pitched, negotiating, contracted, or already active.
          </p>
        </article>

        <article className="rounded-[28px] border border-black/10 bg-parchment p-6 shadow-card">
          <p className="eyebrow text-[11px] text-fog">Pipeline value</p>
          <p className="mt-3 text-5xl font-semibold text-plum">
            {model.stats.pipelineValueLabel}
          </p>
          <p className="mt-3 text-sm leading-7 text-fog">
            Based on current estimated values across the full pipeline.
          </p>
        </article>

        <article className="rounded-[28px] border border-black/10 bg-white/75 p-6 shadow-card">
          <p className="eyebrow text-[11px] text-fog">Wallet pulse</p>
          <p className="mt-3 text-5xl font-semibold text-sand">
            {model.stats.walletHeadline.count}
          </p>
          <p className="mt-3 text-sm leading-7 text-fog">
            {model.stats.walletHeadline.detail}
          </p>
        </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <article className="paper-panel rounded-card border border-black/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow text-[11px] text-fog">Pipeline by stage</p>
              <h3 className="display-title mt-2 text-3xl text-ink">Deal movement</h3>
            </div>
            <p className="text-sm text-fog">{model.stats.totalDeals} total deals</p>
          </div>

          <div className="mt-6 space-y-4">
            {Object.entries(model.stageCounts).map(([stage, count]) => (
              <div key={stage} className="grid grid-cols-[110px_1fr_40px] items-center gap-4">
                <p className="text-sm font-semibold capitalize text-ink">{stage}</p>
                <div className="h-3 rounded-full bg-black/6">
                  <div
                    className="h-3 rounded-full bg-ink"
                    style={{
                      width: `${
                        count > 0 && model.stats.totalDeals > 0
                          ? Math.max((count / model.stats.totalDeals) * 100, 8)
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <p className="text-right text-sm text-fog">{count}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[28px] border border-black/10 bg-ink p-6 text-paper shadow-card">
          <p className="eyebrow text-[11px] text-paper/55">Recent focus</p>
          <div className="mt-6 space-y-4">
            {model.recentDeals.map((deal) => (
              <div
                key={deal.id}
                className="rounded-[22px] border border-white/10 bg-white/6 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{deal.brandName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-paper/58">
                      {deal.stage}
                    </p>
                  </div>
                  <p className="text-sm text-paper/70">{deal.valueLabel}</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-paper/72">
                  {deal.fitScoreLabel}
                  {deal.notes ? ` • ${deal.notes}` : ""}
                </p>
              </div>
            ))}

            {model.recentDeals.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-white/20 p-5 text-sm leading-7 text-paper/70">
                <p className="text-base font-semibold text-paper">{model.emptyState.title}</p>
                <p className="mt-2">{model.emptyState.detail}</p>
              </div>
            ) : null}
          </div>
        </article>
        </section>
      </div>
    </DashboardAuthGate>
  );
}
