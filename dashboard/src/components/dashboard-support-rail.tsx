"use client";

import type { DashboardHomeSupportRailModel } from "@/lib/dashboard-home";

const STAGE_ACCENT: Record<string, { bg: string; text: string; border: string }> = {
  discovered: { bg: "var(--accent-pink-bg)", text: "var(--accent-pink)", border: "var(--accent-pink-border)" },
  pitched:    { bg: "var(--accent-blue-bg)", text: "var(--accent-blue)", border: "var(--accent-blue-border)" },
  responded:  { bg: "#fff8e1", text: "#e6a817", border: "#ffe082" },
  negotiating:{ bg: "#fff3e0", text: "#e65100", border: "#ffcc80" },
  contracted: { bg: "var(--accent-green-bg)", text: "var(--accent-green-text)", border: "var(--accent-green-border)" },
  active:     { bg: "var(--accent-green-bg)", text: "var(--accent-green-text)", border: "var(--accent-green-border)" },
  completed:  { bg: "var(--bg-input)", text: "var(--text-tertiary)", border: "var(--border-default)" },
  lost:       { bg: "var(--accent-pink-bg)", text: "var(--text-tertiary)", border: "var(--accent-pink-border)" },
};
import { formatDashboardDateTime } from "@/lib/datetime";
import { IconCard, IconChevronRight, IconGrid, IconPulse, IconCheck } from "./icons";

export function DashboardSupportRail({
  model,
  onApprove,
  onSkip,
  working,
}: {
  model: DashboardHomeSupportRailModel;
  onApprove?: (actionId: string) => void;
  onSkip?: (actionId: string) => void;
  working?: boolean;
}) {
  const hasPendingActions = model.pendingActions.length > 0;

  return (
    <aside className="space-y-0">
      {/* Pending actions — shown at top when agent has surfaced actions */}
      {hasPendingActions && (
        <>
          <section
            style={{
              paddingBottom: "var(--space-section)",
              borderRadius: "var(--radius-card)",
              background: "var(--gradient-approval)",
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <IconCheck size={14} className="opacity-70" />
              <p style={{ fontSize: 13, fontWeight: 600, color: "white", margin: 0 }}>
                Actions waiting on you
              </p>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 99,
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                }}
              >
                {model.pendingActions.length}
              </span>
            </div>
            <div className="space-y-2">
              {model.pendingActions.map((action) => (
                <div
                  key={action.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-input)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.08)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.55)",
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: "0.4px",
                    }}
                  >
                    {action.type}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "white",
                      margin: "4px 0 0",
                    }}
                  >
                    {action.description}
                  </p>
                  {action.preview ? (
                    <p
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.65)",
                        margin: "4px 0 0",
                        lineHeight: 1.5,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {action.preview}
                    </p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => onApprove?.(action.actionId)}
                      disabled={working}
                      className="disabled:opacity-50 transition hover:opacity-90"
                      style={{
                        background: "var(--accent-green)",
                        color: "white",
                        borderRadius: "var(--radius-chip)",
                        padding: "5px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onSkip?.(action.actionId)}
                      disabled={working}
                      className="disabled:opacity-50 transition hover:opacity-90"
                      style={{
                        background: "rgba(255,255,255,0.12)",
                        color: "white",
                        borderRadius: "var(--radius-chip)",
                        padding: "5px 12px",
                        fontSize: 11,
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
          </section>
          <div style={{ height: 1, background: "var(--border-default)", marginBottom: 16 }} />
        </>
      )}

      {/* Opportunities */}
      <section style={{ paddingBottom: "var(--space-section)" }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconCard size={14} className="text-text-tertiary" />
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              Opportunities
            </p>
          </div>
          <a
            href="/dashboard/deals"
            style={{ fontSize: 12, fontWeight: 500, color: "var(--accent-blue)" }}
          >
            View all →
          </a>
        </div>
        <div className="space-y-2">
          {model.opportunities.map((opp, i) => {
            const stageColor = STAGE_ACCENT[opp.stage] ?? STAGE_ACCENT.discovered;
            const href = opp.id ? `/dashboard/deals#deal-${opp.id}` : "/dashboard/deals";
            return (
              <a
                key={opp.id || `${opp.title}-${i}`}
                href={href}
                className="block transition-transform duration-150 hover:-translate-y-0.5"
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-button)",
                  background: i === 0 ? "var(--accent-blue-bg)" : "transparent",
                  border: i === 0 ? "1px solid var(--accent-blue-border)" : "1px solid var(--border-default)",
                  textDecoration: "none",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                    {opp.title}
                  </p>
                  {opp.value ? (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: i === 0 ? "var(--accent-blue)" : "var(--text-primary)",
                        flexShrink: 0,
                      }}
                    >
                      {opp.value}
                    </span>
                  ) : null}
                </div>
                {opp.stage ? (
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 99,
                        background: stageColor.bg,
                        color: stageColor.text,
                        border: `1px solid ${stageColor.border}`,
                      }}
                    >
                      {opp.stage}
                    </span>
                    {opp.fitScore != null ? (
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {opp.fitScore}% fit
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </a>
            );
          })}
        </div>
      </section>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border-default)" }} />

      {/* Recent activity */}
      <section style={{ padding: "var(--space-section) 0" }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconPulse size={14} className="text-text-tertiary" />
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              Recent activity
            </p>
          </div>
        </div>
        <div className="space-y-0">
          {model.activity.length > 0 ? (
            model.activity.map((item, i) => (
              <div
                key={`${item.title}-${i}`}
                className="flex items-center gap-3 transition-colors duration-150 hover:bg-[var(--bg-surface)]"
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border-default)",
                }}
              >
                <div
                  className="flex shrink-0 items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "var(--radius-chip)",
                    background: "var(--accent-green-bg)",
                  }}
                >
                  <span style={{ fontSize: 14 }}>💰</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ fontSize: 13, color: "var(--text-primary)", margin: 0 }}>
                    {item.title}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "1px 0 0" }}>
                    {item.detail} · {formatDashboardDateTime(item.timestamp)}
                  </p>
                </div>
                <IconChevronRight size={12} className="shrink-0 text-text-muted" />
              </div>
            ))
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              No activity yet. Agent actions will appear here.
            </p>
          )}
        </div>
      </section>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border-default)" }} />

      {/* Connected channels */}
      <section style={{ paddingTop: "var(--space-section)" }}>
        <div className="mb-3 flex items-center gap-2">
          <IconGrid size={14} className="text-text-tertiary" />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Connected channels
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {model.channels.length > 0 ? (
            model.channels.map((channel) => (
              <span
                key={channel.label}
                className="transition-transform duration-150 hover:scale-105"
                style={{
                  borderRadius: "var(--radius-chip)",
                  padding: "5px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  background:
                    channel.status === "connected"
                      ? "var(--accent-green-bg)"
                      : "var(--bg-disconnected)",
                  color:
                    channel.status === "connected"
                      ? "var(--accent-green-text)"
                      : "var(--text-tertiary)",
                }}
              >
                {channel.label}
              </span>
            ))
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              No channels connected yet. Link Telegram or a social account in Settings.
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}
