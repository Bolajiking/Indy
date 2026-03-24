"use client";

import React, { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgentConsole } from "@/components/agent-console";
import { CommandBar } from "@/components/command-bar";
import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { DashboardHomeHero } from "@/components/dashboard-home-hero";
import { DashboardSupportRail } from "@/components/dashboard-support-rail";
import { IconBarChart, IconList } from "@/components/icons";
import { fetchDeals } from "@/lib/api";
import {
  EMPTY_HOME_DATA,
  buildDashboardHomeModel,
  fetchDashboardHome,
  getAgentConsoleHomeState,
} from "@/lib/dashboard-home";
import { subscribeDealsChanged } from "@/lib/deals-sync";
import { useAuthedQuery } from "@/lib/use-authed-query";

function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialQuery, setInitialQuery] = useState<string | undefined>(undefined);

  // Read ?q= param or sessionStorage pending query once on mount, then clear
  useEffect(() => {
    const qParam = searchParams.get("q");
    if (qParam) {
      setInitialQuery(decodeURIComponent(qParam));
      router.replace("/dashboard");
      return;
    }
    try {
      const pending = sessionStorage.getItem("indyfren_pending_query");
      if (pending) {
        setInitialQuery(pending);
        sessionStorage.removeItem("indyfren_pending_query");
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, error, isLoading, refresh } = useAuthedQuery(fetchDashboardHome, EMPTY_HOME_DATA);
  const { data: liveDealsList, refresh: refreshDeals } = useAuthedQuery(fetchDeals, []);
  const model = useMemo(
    () => buildDashboardHomeModel({ ...data, deals: liveDealsList.length > 0 ? liveDealsList : data.deals }),
    [data, liveDealsList]
  );

  // Refresh when user returns to this tab after being away
  const stableRefresh = useCallback(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        stableRefresh();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [stableRefresh]);

  // Fast deals-only refresh when the agent surfaces new deals (same-tab via BroadcastChannel)
  const stableRefreshDeals = useCallback(() => { void refreshDeals(); }, [refreshDeals]);
  useEffect(() => subscribeDealsChanged(stableRefreshDeals), [stableRefreshDeals]);
  const agentConsoleState = useMemo(
    () => getAgentConsoleHomeState({ isLoading, error, agentState: data.agentState }),
    [isLoading, error, data.agentState]
  );

  return (
    <DashboardAuthGate>
      <div className="space-y-6">
        <DashboardHomeHero model={model.hero} />

        <CommandBar />

        <div style={{ height: 1, background: "var(--border-default)", margin: "var(--space-section) 0" }} />

        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <IconList size={14} className="text-text-tertiary" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Workspace</span>
        </div>

        {agentConsoleState.showLoadingShell ? (
          <section className="grid lg:grid-cols-2" style={{ gap: "var(--column-gap)" }}>
            <article
              style={{
                background: "var(--bg-surface)",
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--border-default)",
                padding: 24
              }}
            >
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Agent workspace</p>
              <h3 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", marginTop: 8 }}>
                Loading your conversation.
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
                Collecting your latest messages, approvals, and agent context.
              </p>
            </article>
            <DashboardSupportRail model={model.supportRail} />
          </section>
        ) : (
          <section
            id="agent-workspace"
            className="grid lg:grid-cols-2"
            style={{ gap: "var(--column-gap)" }}
          >
            <AgentConsole
              initialState={agentConsoleState.initialState}
              isHydrated={agentConsoleState.isHydrated}
              onDealsChanged={() => { void refresh(); }}
              initialQuery={initialQuery}
            />
            <DashboardSupportRail model={model.supportRail} />
          </section>
        )}

        <div style={{ height: 1, background: "var(--border-default)", margin: "var(--space-section) 0" }} />

        <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
          <IconBarChart size={14} className="text-text-tertiary" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>At a glance</span>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {model.insights.map((insight) => (
            <article
              key={insight.label}
              style={{
                padding: 18,
                borderRadius: "var(--radius-card)",
                border: "1px solid var(--border-default)",
                background: "var(--bg-canvas)"
              }}
            >
              <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{insight.label}</p>
              <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--text-primary)", marginTop: 4 }}>{insight.value}</p>
              <p style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>{insight.detail}</p>
            </article>
          ))}
        </section>
      </div>
    </DashboardAuthGate>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageInner />
    </Suspense>
  );
}
