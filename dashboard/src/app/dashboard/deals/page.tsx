"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { PageHead, StatCard, EmptyState } from "@/components/cf/ui";
import { Icon, FrenBadge } from "@/components/cf/primitives";
import {
  fetchAgentState,
  fetchDeals,
  formatCurrency,
  patchDealStage,
  type DashboardAgentState,
  type DashboardDeal,
  type DashboardDealStage,
} from "@/lib/api";
import { broadcastDealsChanged, subscribeDealsChanged } from "@/lib/deals-sync";
import { useAuthedQuery } from "@/lib/use-authed-query";
import { useAuth } from "@/lib/auth-context";

const EMPTY_AGENT_STATE: DashboardAgentState = {
  messages: [],
  pendingApprovals: [],
};

const STAGE: Record<DashboardDealStage, { label: string; color: string }> = {
  discovered: { label: "Discovered", color: "#8DAAFF" },
  pitched: { label: "Pitched", color: "#4D7AFF" },
  responded: { label: "Responded", color: "#C8EB6D" },
  negotiating: { label: "Negotiating", color: "#40ACFF" },
  contracted: { label: "Contracted", color: "#5ACDFF" },
  active: { label: "Active", color: "#40FFCC" },
  completed: { label: "Completed", color: "#9aa0b5" },
  lost: { label: "Lost", color: "#FF6B6B" },
};

const CTAS: Record<
  DashboardDealStage,
  {
    primary?: { label: string; stage: DashboardDealStage };
    secondary?: { label: string; stage: DashboardDealStage };
  }
> = {
  discovered: {
    primary: { label: "Pitch now", stage: "pitched" },
    secondary: { label: "Dismiss", stage: "lost" },
  },
  pitched: {
    primary: { label: "Mark responded", stage: "responded" },
    secondary: { label: "Not interested", stage: "lost" },
  },
  responded: {
    primary: { label: "Start negotiating", stage: "negotiating" },
    secondary: { label: "Decline", stage: "lost" },
  },
  negotiating: {
    primary: { label: "Contract signed", stage: "contracted" },
    secondary: { label: "Walk away", stage: "lost" },
  },
  contracted: {
    primary: { label: "Go live", stage: "active" },
    secondary: { label: "Cancel", stage: "lost" },
  },
  active: { primary: { label: "Mark completed", stage: "completed" } },
  completed: {},
  lost: { primary: { label: "Reopen", stage: "discovered" } },
};

const FILTERS: Array<[string, string]> = [
  ["all", "All"],
  ["discovered", "Discovered"],
  ["progress", "In progress"],
  ["active", "Active"],
];

function DealCard({
  deal,
  token,
  onOptimisticStage,
  onServerDeal,
  onChange,
}: {
  deal: DashboardDeal;
  token: string;
  onOptimisticStage: (dealId: string, stage: DashboardDealStage) => void;
  onServerDeal: (deal: DashboardDeal) => void;
  onChange: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const st = STAGE[deal.stage] ?? STAGE.discovered;
  const ctas = CTAS[deal.stage] ?? {};
  const { primary, secondary } = ctas;
  const value = deal.actual_value_cents ?? deal.estimated_value_cents;
  const isEst = deal.actual_value_cents == null;

  async function move(nextStage: DashboardDealStage) {
    if (!token || working) return;
    setWorking(true);
    setErr(null);
    onOptimisticStage(deal.id, nextStage);
    try {
      const updated = await patchDealStage(token, deal.id, nextStage);
      onServerDeal(updated);
      broadcastDealsChanged();
      onChange();
    } catch (e) {
      onOptimisticStage(deal.id, deal.stage);
      setErr(e instanceof Error ? e.message : "Couldn't move this deal.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      className="gcard"
      style={{
        padding: 20,
        display: "flex",
        gap: 20,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 280px", minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 6,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            {deal.brand_name}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 24,
              padding: "0 11px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: st.color,
              border: `1px solid ${st.color}55`,
              background: `${st.color}1a`,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: st.color,
              }}
            />
            {st.label}
          </span>
        </div>
        {(deal.brand_contact_name || deal.brand_contact_email) && (
          <div
            style={{
              fontSize: 13,
              color: "rgb(var(--ink) / 0.45)",
              marginBottom: 8,
            }}
          >
            {deal.brand_contact_name}
            {deal.brand_contact_email ? ` · ${deal.brand_contact_email}` : ""}
          </div>
        )}
        {(deal.response_text || deal.notes) && (
          <p
            style={{
              fontSize: 13.5,
              lineHeight: 1.5,
              color: "rgb(var(--ink) / 0.7)",
              margin: 0,
              maxWidth: 460,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {deal.response_text || deal.notes}
          </p>
        )}
        {err && (
          <p style={{ fontSize: 12, color: "var(--cf-coral)", marginTop: 8 }}>
            {err}
          </p>
        )}
      </div>

      {value != null && (
        <div style={{ flex: "none", textAlign: "right", minWidth: 96 }}>
          <div
            style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            {isEst ? "~" : ""}
            {formatCurrency(value)}
          </div>
          {deal.fit_score != null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                justifyContent: "flex-end",
                marginTop: 5,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 5,
                  borderRadius: 99,
                  background: "rgb(var(--ink) / 0.12)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${deal.fit_score}%`,
                    height: "100%",
                    background: "var(--cf-cta-gradient)",
                    borderRadius: 99,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "rgb(var(--ink) / 0.6)",
                  whiteSpace: "nowrap",
                }}
              >
                {deal.fit_score}%
              </span>
            </div>
          )}
        </div>
      )}

      {(primary || secondary) && (
        <div style={{ flex: "none", display: "flex", gap: 8 }}>
          {primary && (
            <button
              className="dark-pill dark-pill--solid"
              disabled={working}
              onClick={() => void move(primary.stage)}
              style={{ height: 42 }}
            >
              {working ? "Moving…" : primary.label}{" "}
              {Icon.arrowR({ size: 15, color: "#fff" })}
            </button>
          )}
          {secondary && (
            <button
              className="dark-pill"
              disabled={working}
              onClick={() => void move(secondary.stage)}
              style={{ height: 42, color: "rgb(var(--ink) / 0.6)" }}
            >
              {secondary.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DealsInner() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const {
    data: deals,
    isLoading,
    refresh,
    setData: setDeals,
  } = useAuthedQuery(fetchDeals, [], "indyfren_deals_v1");
  const { data: agentState, refresh: refreshAgent } = useAuthedQuery(
    fetchAgentState,
    EMPTY_AGENT_STATE,
    "indyfren_agent_v1",
  );
  const [filter, setFilter] = useState("all");

  const stableRefresh = useCallback(() => {
    if (document.visibilityState !== "visible") {
      return;
    }
    void refresh();
    void refreshAgent();
  }, [refresh, refreshAgent]);
  useEffect(() => subscribeDealsChanged(stableRefresh), [stableRefresh]);
  useEffect(() => {
    const id = setInterval(stableRefresh, 15_000);
    return () => clearInterval(id);
  }, [stableRefresh]);
  const optimisticStage = useCallback(
    (dealId: string, stage: DashboardDealStage) => {
      setDeals((current) =>
        current.map((deal) =>
          deal.id === dealId
            ? { ...deal, stage, updated_at: new Date().toISOString() }
            : deal,
        ),
      );
    },
    [setDeals],
  );
  const applyServerDeal = useCallback(
    (updated: DashboardDeal) => {
      setDeals((current) =>
        current.map((deal) => (deal.id === updated.id ? updated : deal)),
      );
    },
    [setDeals],
  );

  const pipelineValue = deals.reduce(
    (s, d) => s + (d.estimated_value_cents ?? 0),
    0,
  );
  const activeCount = deals.filter((d) =>
    ["pitched", "responded", "negotiating", "contracted", "active"].includes(
      d.stage,
    ),
  ).length;
  const closing = deals
    .filter((d) => ["contracted", "active"].includes(d.stage))
    .reduce(
      (s, d) => s + (d.actual_value_cents ?? d.estimated_value_cents ?? 0),
      0,
    );
  const pending = agentState.pendingApprovals.length;

  const shown = deals.filter((d) =>
    filter === "all"
      ? true
      : filter === "progress"
        ? ["pitched", "responded", "negotiating", "contracted"].includes(
            d.stage,
          )
        : d.stage === filter,
  );

  return (
    <div className="page-wrap">
      <div className="page-inner">
        <PageHead eyebrow="Deal pipeline" title="Your deals, working for you" />

        {pending > 0 && (
          <div
            className="on-ink"
            style={{
              background:
                "linear-gradient(135deg, rgba(28,30,54,0.9), rgba(16,17,34,0.92))",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <FrenBadge
              pose="handshake"
              size={44}
              radius={13}
              bg="rgb(var(--ink) / 0.08)"
              color="#fff"
              colorB="var(--cf-accent-blue)"
              inset={0.62}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>
                {pending} approval{pending === 1 ? "" : "s"} waiting
              </div>
              <div style={{ fontSize: 13, color: "rgb(var(--ink) / 0.55)" }}>
                Review and approve in your agent console.
              </div>
            </div>
            <button
              className="dark-pill dark-pill--mint"
              onClick={() => router.push("/dashboard")}
            >
              Review
            </button>
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 22,
            flexWrap: "wrap",
          }}
        >
          <StatCard
            label="Pipeline value"
            value={formatCurrency(pipelineValue)}
          />
          <StatCard
            label="Active deals"
            value={String(activeCount)}
            accent="var(--cf-cyan)"
          />
          <StatCard
            label="Closing soon"
            value={formatCurrency(closing)}
            accent="var(--cf-grad-end)"
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          {FILTERS.map(([k, l]) => (
            <button
              key={k}
              className="seg-chip"
              data-active={filter === k}
              onClick={() => setFilter(k)}
            >
              {l}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {shown.map((d) => (
            <DealCard
              key={d.id}
              deal={d}
              token={accessToken ?? ""}
              onOptimisticStage={optimisticStage}
              onServerDeal={applyServerDeal}
              onChange={stableRefresh}
            />
          ))}
          {shown.length === 0 && (
            <div className="gcard" style={{ padding: 28 }}>
              <EmptyState
                title={isLoading ? "Loading deals…" : "No deals here yet"}
                detail={
                  isLoading
                    ? "Pulling your pipeline."
                    : "Ask Indyfren to scan the brand landscape and your matches will appear here."
                }
                action={
                  !isLoading ? (
                    <button
                      className="dark-pill dark-pill--solid"
                      onClick={() =>
                        router.push(
                          "/dashboard?q=" +
                            encodeURIComponent(
                              "Scan for brand deals that fit me",
                            ),
                        )
                      }
                    >
                      Scan for deals
                    </button>
                  ) : null
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DealsPage() {
  return (
    <DashboardAuthGate>
      <DealsInner />
    </DashboardAuthGate>
  );
}
