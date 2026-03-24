"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import {
  DEAL_STAGE_ORDER,
  approveAgentAction,
  fetchDeals,
  fetchAgentState,
  formatCurrency,
  patchDealStage,
  skipAgentAction,
  type DashboardDeal,
} from "@/lib/api";
import { EMPTY_AGENT_STATE } from "@/lib/dashboard-home";
import { broadcastDealsChanged, subscribeDealsChanged } from "@/lib/deals-sync";
import { useAuthedQuery } from "@/lib/use-authed-query";
import { formatDashboardDateTime } from "@/lib/datetime";
import { useAuth } from "@/lib/privy";

const STAGE_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  discovered: { bg: "var(--accent-pink-bg)", text: "var(--accent-pink)", border: "var(--accent-pink-border)", dot: "var(--accent-pink)" },
  pitched:    { bg: "var(--accent-blue-bg)", text: "var(--accent-blue)", border: "var(--accent-blue-border)", dot: "var(--accent-blue)" },
  responded:  { bg: "#fff8e1", text: "#e6a817", border: "#ffe082", dot: "#e6a817" },
  negotiating:{ bg: "#fff3e0", text: "#e65100", border: "#ffcc80", dot: "#e65100" },
  contracted: { bg: "var(--accent-green-bg)", text: "var(--accent-green-text)", border: "var(--accent-green-border)", dot: "var(--accent-green)" },
  active:     { bg: "var(--accent-green-bg)", text: "var(--accent-green-text)", border: "var(--accent-green-border)", dot: "var(--accent-green)" },
  completed:  { bg: "var(--bg-input)", text: "var(--text-tertiary)", border: "var(--border-default)", dot: "var(--text-muted)" },
  lost:       { bg: "var(--accent-pink-bg)", text: "var(--text-tertiary)", border: "var(--accent-pink-border)", dot: "var(--text-muted)" },
};

const STAGE_LABELS: Record<string, string> = {
  discovered: "Discovered",
  pitched: "Pitched",
  responded: "Responded",
  negotiating: "Negotiating",
  contracted: "Contracted",
  active: "Active",
  completed: "Completed",
  lost: "Lost",
};

export default function DealsPage() {
  const { accessToken } = useAuth();
  const { data: deals, error, isLoading, refresh } = useAuthedQuery(fetchDeals, [], "indyfren_deals_v1");
  const { data: agentState, refresh: refreshAgentState } = useAuthedQuery(fetchAgentState, EMPTY_AGENT_STATE, "indyfren_agent_v1");
  const [actionWorking, setActionWorking] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Unified refresh: deals + agent state together
  const stableRefresh = useCallback(() => {
    void refresh();
    void refreshAgentState();
  }, [refresh, refreshAgentState]);

  // Auto-refresh every 10s
  useEffect(() => {
    const id = setInterval(stableRefresh, 10_000);
    return () => clearInterval(id);
  }, [stableRefresh]);

  // Cross-context sync via BroadcastChannel
  useEffect(() => subscribeDealsChanged(stableRefresh), [stableRefresh]);

  // Refresh when user returns to this tab
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") stableRefresh();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [stableRefresh]);

  const totalDeals = deals.length;
  const pipelineValue = deals.reduce((sum, d) => sum + (d.estimated_value_cents ?? 0), 0);
  const pendingApprovals = agentState.pendingApprovals;

  async function handleApprove(actionId: string) {
    if (!accessToken) return;
    setActionWorking(true);
    setActionMessage(null);
    try {
      const response = await approveAgentAction(accessToken, actionId);
      setActionMessage(
        response.execution?.costCents
          ? `${response.execution.message} ($${(response.execution.costCents / 100).toFixed(2)})`
          : response.execution?.message ?? "Approved and executed."
      );
      stableRefresh();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Unable to approve that action.");
    } finally {
      setActionWorking(false);
    }
  }

  async function handleSkip(actionId: string) {
    if (!accessToken) return;
    setActionWorking(true);
    setActionMessage(null);
    try {
      await skipAgentAction(accessToken, actionId);
      setActionMessage("Action skipped.");
      stableRefresh();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Unable to skip that action.");
    } finally {
      setActionWorking(false);
    }
  }

  return (
    <DashboardAuthGate>
      <div className="space-y-6">
        {/* Header */}
        <section style={{ background: "var(--bg-canvas)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-card)", padding: "24px 32px" }}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Deal pipeline</p>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 12, lineHeight: 1, color: "var(--text-primary)" }}>Your brand deal pipeline</h2>
              <p className="mt-4 max-w-3xl text-sm leading-7" style={{ color: "var(--text-tertiary)" }}>
                Sponsor opportunities move through stages automatically as Indyfren scouts,
                pitches, and closes deals on your behalf. Every live opportunity is tracked here.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{totalDeals}</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>total deals</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: "var(--accent-blue)" }}>{formatCurrency(pipelineValue)}</p>
                <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>pipeline value</p>
              </div>
              <button
                onClick={stableRefresh}
                disabled={isLoading}
                style={{
                  border: "1.5px solid var(--border-default)",
                  borderRadius: "var(--radius-button)",
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  background: "var(--bg-input)",
                  cursor: "pointer",
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                {isLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
          {error ? (
            <p className="mt-4 rounded-[18px] px-4 py-3 text-sm" style={{ border: "1px solid var(--accent-pink-border)", background: "var(--accent-pink-bg)", color: "var(--text-primary)" }}>
              {error}
            </p>
          ) : null}
        </section>

        {/* Pending agent actions — shown when agent has surfaced actions requiring approval */}
        {pendingApprovals.length > 0 && (
          <section
            style={{
              borderRadius: "var(--radius-card)",
              background: "var(--gradient-approval)",
              padding: "20px 24px",
              color: "white",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: "0.4px", textTransform: "uppercase" }}>
                  Agent actions
                </p>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "white", marginTop: 4 }}>
                  {pendingApprovals.length} action{pendingApprovals.length === 1 ? "" : "s"} waiting for your approval
                </h3>
              </div>
              <Link
                href="/dashboard"
                style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.7)", textDecoration: "none" }}
              >
                View in console →
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingApprovals.map((approval) => (
                <div
                  key={approval.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "var(--radius-input)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.07)",
                  }}
                >
                  <p style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                    {approval.type}
                  </p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "white", margin: "5px 0 0" }}>
                    {approval.description}
                  </p>
                  {approval.preview ? (
                    <p
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.65)",
                        margin: "5px 0 0",
                        lineHeight: 1.5,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {approval.preview}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => { void handleApprove(approval.actionId); }}
                      disabled={actionWorking}
                      className="disabled:opacity-50 transition hover:opacity-90"
                      style={{
                        background: "var(--accent-green)",
                        color: "white",
                        borderRadius: "var(--radius-chip)",
                        padding: "5px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { void handleSkip(approval.actionId); }}
                      disabled={actionWorking}
                      className="disabled:opacity-50 transition hover:opacity-90"
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        color: "white",
                        borderRadius: "var(--radius-chip)",
                        padding: "5px 14px",
                        fontSize: 12,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {actionMessage ? (
              <p style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>{actionMessage}</p>
            ) : null}
          </section>
        )}

        {/* Kanban board — horizontal scroll for all 8 stages */}
        <div style={{ overflowX: "auto", paddingBottom: 8 }}>
          <div style={{ display: "flex", gap: 16, minWidth: "max-content" }}>
            {DEAL_STAGE_ORDER.map((stage) => {
              const stageDeals = deals.filter((deal) => deal.stage === stage);
              const colors = STAGE_COLORS[stage] ?? STAGE_COLORS.discovered;
              const label = STAGE_LABELS[stage] ?? stage;

              return (
                <article
                  key={stage}
                  style={{
                    width: 240,
                    flexShrink: 0,
                    borderRadius: "var(--radius-card)",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-canvas)",
                    padding: 16,
                  }}
                >
                  {/* Stage header */}
                  <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                    <div className="flex items-center gap-2">
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: colors.dot,
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{label}</h3>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: stageDeals.length > 0 ? colors.bg : "var(--bg-input)",
                        color: stageDeals.length > 0 ? colors.text : "var(--text-tertiary)",
                        border: `1px solid ${stageDeals.length > 0 ? colors.border : "var(--border-default)"}`,
                      }}
                    >
                      {stageDeals.length}
                    </span>
                  </div>

                  {/* Deal cards */}
                  <div className="space-y-3">
                    {stageDeals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        colors={colors}
                        anchorId={`deal-${deal.id}`}
                        accessToken={accessToken ?? ""}
                        onStageChange={stableRefresh}
                      />
                    ))}

                    {stageDeals.length === 0 ? (
                      <div
                        style={{
                          border: "1px dashed var(--border-default)",
                          borderRadius: "var(--radius-button)",
                          padding: "14px 12px",
                          fontSize: 12,
                          color: "var(--text-tertiary)",
                          lineHeight: 1.6,
                        }}
                      >
                        {isLoading ? (
                          "Loading…"
                        ) : stage === "discovered" ? (
                          <Link href="/dashboard" style={{ color: "var(--accent-blue)", fontWeight: 600 }}>
                            Ask Indyfren to scan →
                          </Link>
                        ) : (
                          "Nothing here yet."
                        )}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardAuthGate>
  );
}

// Per-stage CTAs: primary action moves the deal forward; secondary dismisses/archives it
const STAGE_CTAS: Record<string, { primary?: { label: string; stage: string }; secondary?: { label: string; stage: string } }> = {
  discovered:  { primary: { label: "Pitch now →",       stage: "pitched"     }, secondary: { label: "Dismiss",  stage: "lost"      } },
  pitched:     { primary: { label: "Mark responded",    stage: "responded"   }, secondary: { label: "Not interested", stage: "lost" } },
  responded:   { primary: { label: "Start negotiating", stage: "negotiating" }, secondary: { label: "Decline",  stage: "lost"      } },
  negotiating: { primary: { label: "Contract signed",   stage: "contracted"  }, secondary: { label: "Walk away", stage: "lost"     } },
  contracted:  { primary: { label: "Go live →",         stage: "active"      }, secondary: { label: "Cancel",   stage: "lost"      } },
  active:      { primary: { label: "Mark completed ✓",  stage: "completed"   }, secondary: { label: "Cancel",   stage: "lost"      } },
  completed:   {},
  lost:        { primary: { label: "Reopen",            stage: "discovered"  } },
};

function DealCard({
  deal,
  colors,
  anchorId,
  accessToken,
  onStageChange,
}: {
  deal: DashboardDeal;
  colors: { bg: string; text: string; border: string; dot: string };
  anchorId?: string;
  accessToken: string;
  onStageChange: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [working, setWorking] = useState(false);

  const ctas = STAGE_CTAS[deal.stage] ?? {};

  async function handleStage(stage: string) {
    if (!accessToken || working) return;
    setWorking(true);
    try {
      await patchDealStage(accessToken, deal.id, stage);
      broadcastDealsChanged();
      onStageChange();
    } finally {
      setWorking(false);
    }
  }

  const activeValue = deal.actual_value_cents ?? deal.estimated_value_cents;
  const isActual = deal.actual_value_cents != null;

  return (
    <div
      id={anchorId}
      style={{
        borderRadius: "var(--radius-button)",
        border: `1px solid ${colors.border}`,
        background: "var(--bg-surface)",
        padding: 12,
        scrollMarginTop: 80,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, flex: 1 }}>
          {deal.brand_name}
        </p>
        {activeValue ? (
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.text, flexShrink: 0 }}>
            {isActual ? "" : "~"}{formatCurrency(activeValue)}
          </p>
        ) : null}
      </div>

      {/* Brand contact */}
      {deal.brand_contact_name ? (
        <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "3px 0 0" }}>
          {deal.brand_contact_name}
          {deal.brand_contact_email ? ` · ${deal.brand_contact_email}` : ""}
        </p>
      ) : null}

      {/* Fit score */}
      {deal.fit_score != null ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>Fit</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: colors.text }}>{deal.fit_score}%</span>
          </div>
          <div style={{ height: 3, borderRadius: 99, background: "var(--border-default)", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${deal.fit_score}%`,
                borderRadius: 99,
                background: colors.dot,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Notes */}
      {deal.notes ? (
        <p
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            margin: "6px 0 0",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: expanded ? undefined : 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {deal.notes}
        </p>
      ) : null}

      {/* Response text */}
      {deal.response_text ? (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: "var(--radius-chip)",
            background: "var(--accent-green-bg)",
            border: "1px solid var(--accent-green-border)",
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--accent-green-text)", marginBottom: 3 }}>
            Brand replied{deal.responded_at ? ` · ${formatDashboardDateTime(deal.responded_at)}` : ""}
          </p>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-primary)",
              margin: 0,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: expanded ? undefined : 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {deal.response_text}
          </p>
        </div>
      ) : null}

      {/* Contract notes */}
      {deal.contract_notes && expanded ? (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            borderRadius: "var(--radius-chip)",
            background: "var(--bg-canvas)",
            border: "1px solid var(--border-default)",
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-tertiary)", marginBottom: 3 }}>Contract notes</p>
          <p style={{ fontSize: 11, color: "var(--text-primary)", margin: 0 }}>{deal.contract_notes}</p>
        </div>
      ) : null}

      {/* Pitch status */}
      {deal.pitch_sent_at && expanded ? (
        <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
          Pitch sent {formatDashboardDateTime(deal.pitch_sent_at)}
        </p>
      ) : null}

      {/* Expand toggle */}
      {(deal.pitch_text || deal.contract_notes || deal.pitch_sent_at || (deal.notes?.length ?? 0) > 80 || (deal.response_text?.length ?? 0) > 100) ? (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            marginTop: 6,
            fontSize: 10,
            color: colors.text,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontWeight: 500,
          }}
        >
          {expanded ? "Show less ↑" : "Show more ↓"}
        </button>
      ) : null}

      {/* Stage CTAs */}
      {(ctas.primary || ctas.secondary) ? (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {ctas.primary ? (
            <button
              onClick={() => { void handleStage(ctas.primary!.stage); }}
              disabled={working}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: "var(--radius-chip)",
                background: colors.bg,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                cursor: working ? "not-allowed" : "pointer",
                opacity: working ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {working ? "…" : ctas.primary.label}
            </button>
          ) : null}
          {ctas.secondary ? (
            <button
              onClick={() => { void handleStage(ctas.secondary!.stage); }}
              disabled={working}
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "4px 10px",
                borderRadius: "var(--radius-chip)",
                background: "transparent",
                color: "var(--text-tertiary)",
                border: "1px solid var(--border-default)",
                cursor: working ? "not-allowed" : "pointer",
                opacity: working ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {ctas.secondary.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Updated timestamp */}
      <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
        Updated {formatDashboardDateTime(deal.updated_at)}
      </p>
    </div>
  );
}
