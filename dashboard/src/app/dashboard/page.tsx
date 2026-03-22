"use client";

import React from "react";

import { AgentConsole } from "@/components/agent-console";
import { CommandBar } from "@/components/command-bar";
import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { DashboardHomeHero } from "@/components/dashboard-home-hero";
import { DashboardSupportRail } from "@/components/dashboard-support-rail";
import { IconBarChart, IconList } from "@/components/icons";
import {
  EMPTY_HOME_DATA,
  buildDashboardHomeModel,
  fetchDashboardHome,
  getAgentConsoleHomeState,
} from "@/lib/dashboard-home";
import { useAuthedQuery } from "@/lib/use-authed-query";

export default function DashboardPage() {
  const { data, error, isLoading } = useAuthedQuery(fetchDashboardHome, EMPTY_HOME_DATA);
  const model = buildDashboardHomeModel(data);
  const agentConsoleState = getAgentConsoleHomeState({
    isLoading,
    error,
    agentState: data.agentState,
  });

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
