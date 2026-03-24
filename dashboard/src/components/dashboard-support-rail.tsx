"use client";

import { useState } from "react";
import Link from "next/link";
import type { DashboardHomeSupportRailModel } from "@/lib/dashboard-home";
import { formatDashboardDateTime } from "@/lib/datetime";
import { IconCard, IconChevronRight, IconGrid, IconPulse, IconCheck } from "./icons";

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

const STAGE_LABELS: Record<string, string> = {
  discovered: "Discovered", pitched: "Pitched", responded: "Responded",
  negotiating: "Negotiating", contracted: "Contracted", active: "Active",
  completed: "Completed", lost: "Lost",
};

function Toast({ message, type, onDismiss }: { message: string; type: "success" | "error"; onDismiss: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: "var(--radius-input)",
        background: type === "success" ? "var(--accent-green-bg)" : "var(--accent-pink-bg)",
        border: `1px solid ${type === "success" ? "var(--accent-green-border)" : "var(--accent-pink-border)"}`,
        marginBottom: 12,
        animation: "fadeIn 0.15s ease",
      }}
    >
      <span style={{ fontSize: 13 }}>{type === "success" ? "✓" : "⚠"}</span>
      <p
        style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 500,
          color: type === "success" ? "var(--accent-green-text)" : "var(--accent-pink)",
          margin: 0,
        }}
      >
        {message}
      </p>
      <button
        onClick={onDismiss}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          color: type === "success" ? "var(--accent-green-text)" : "var(--accent-pink)",
          padding: "0 2px",
          opacity: 0.7,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

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
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [localWorking, setLocalWorking] = useState<string | null>(null);

  const hasPendingActions = model.pendingActions.length > 0;

  async function handleApprove(actionId: string) {
    setLocalWorking(actionId);
    try {
      await Promise.resolve(onApprove?.(actionId));
      setToast({ message: "Action approved — Indyfren is executing it.", type: "success" });
    } catch {
      setToast({ message: "Unable to approve. Please try again.", type: "error" });
    } finally {
      setLocalWorking(null);
      setTimeout(() => setToast(null), 4000);
    }
  }

  async function handleSkip(actionId: string) {
    setLocalWorking(actionId);
    try {
      await Promise.resolve(onSkip?.(actionId));
      setToast({ message: "Action dismissed.", type: "success" });
    } catch {
      setToast({ message: "Unable to skip. Please try again.", type: "error" });
    } finally {
      setLocalWorking(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <aside className="space-y-0">
      {/* Toast notification */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}

      {/* Pending actions — shown at top when agent has surfaced actions */}
      {hasPendingActions && (
        <>
          <section
            style={{
              borderRadius: "var(--radius-card)",
              background: "var(--gradient-approval)",
              padding: "16px",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#ff6b6b",
                  boxShadow: "0 0 0 3px rgba(255,107,107,0.3)",
                  flexShrink: 0,
                }}
              />
              <p style={{ fontSize: 13, fontWeight: 600, color: "white", margin: 0, flex: 1 }}>
                Actions waiting on you
              </p>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 99,
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                }}
              >
                {model.pendingActions.length}
              </span>
            </div>
            <div className="space-y-2">
              {model.pendingActions.map((action) => {
                const isThis = localWorking === action.actionId || (working && !localWorking);
                return (
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
                        color: "rgba(255,255,255,0.5)",
                        margin: 0,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
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
                        lineHeight: 1.4,
                      }}
                    >
                      {action.description}
                    </p>
                    {action.preview ? (
                      <p
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.6)",
                          margin: "5px 0 0",
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
                    <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                      <button
                        onClick={() => { void handleApprove(action.actionId); }}
                        disabled={isThis}
                        style={{
                          background: "var(--accent-green)",
                          color: "white",
                          borderRadius: "var(--radius-chip)",
                          padding: "5px 13px",
                          fontSize: 11,
                          fontWeight: 600,
                          border: "none",
                          cursor: isThis ? "not-allowed" : "pointer",
                          opacity: isThis ? 0.6 : 1,
                          transition: "opacity 0.15s",
                        }}
                      >
                        {isThis ? "Working…" : "Approve"}
                      </button>
                      <button
                        onClick={() => { void handleSkip(action.actionId); }}
                        disabled={isThis}
                        style={{
                          background: "rgba(255,255,255,0.1)",
                          color: "rgba(255,255,255,0.85)",
                          borderRadius: "var(--radius-chip)",
                          padding: "5px 13px",
                          fontSize: 11,
                          fontWeight: 500,
                          border: "1px solid rgba(255,255,255,0.15)",
                          cursor: isThis ? "not-allowed" : "pointer",
                          opacity: isThis ? 0.6 : 1,
                          transition: "opacity 0.15s",
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <div style={{ height: 1, background: "var(--border-default)", marginBottom: 16 }} />
        </>
      )}

      {/* Opportunities */}
      <section style={{ paddingBottom: "var(--space-section)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <IconCard size={13} className="text-text-tertiary" />
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
              Opportunities
            </p>
            {model.opportunities.length > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 99,
                  background: "var(--accent-blue-bg)",
                  color: "var(--accent-blue)",
                  border: "1px solid var(--accent-blue-border)",
                }}
              >
                {model.opportunities.length}
              </span>
            )}
          </div>
          <Link
            href="/dashboard/deals"
            style={{ fontSize: 11, fontWeight: 500, color: "var(--accent-blue)", textDecoration: "none" }}
          >
            View all →
          </Link>
        </div>

        {model.opportunities.length === 0 ? (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--radius-button)",
              border: "1px dashed var(--border-default)",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 6px" }}>
              No opportunities yet
            </p>
            <Link
              href="/dashboard"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-blue)", textDecoration: "none" }}
            >
              Ask Indyfren to scan →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {model.opportunities.map((opp, i) => {
              const stageColor = STAGE_ACCENT[opp.stage] ?? STAGE_ACCENT.discovered;
              const href = opp.id ? `/dashboard/deals#deal-${opp.id}` : "/dashboard/deals";
              return (
                <a
                  key={opp.id || `${opp.title}-${i}`}
                  href={href}
                  style={{
                    display: "block",
                    padding: "11px 13px",
                    borderRadius: "var(--radius-button)",
                    background: i === 0 ? "var(--accent-blue-bg)" : "transparent",
                    border: i === 0 ? "1px solid var(--accent-blue-border)" : "1px solid var(--border-default)",
                    textDecoration: "none",
                    transition: "border-color 0.12s, background 0.12s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {opp.title}
                    </p>
                    {opp.value ? (
                      <span
                        style={{
                          fontSize: 12,
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
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
                        {STAGE_LABELS[opp.stage] ?? opp.stage}
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
        )}
      </section>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border-default)" }} />

      {/* Recent activity */}
      <section style={{ padding: "var(--space-section) 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <IconPulse size={13} className="text-text-tertiary" />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Recent activity
          </p>
        </div>
        <div>
          {model.activity.length > 0 ? (
            model.activity.map((item, i) => (
              <div
                key={`${item.title}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border-default)",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "var(--radius-chip)",
                    background: "var(--accent-green-bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 13,
                  }}
                >
                  💰
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--text-primary)",
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "2px 0 0" }}>
                    {item.detail} · {formatDashboardDateTime(item.timestamp)}
                  </p>
                </div>
                <IconChevronRight size={11} className="shrink-0 text-text-muted" />
              </div>
            ))
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              Wallet transactions and agent activity will appear here.
            </p>
          )}
        </div>
      </section>

      {/* Divider */}
      <div style={{ height: 1, background: "var(--border-default)" }} />

      {/* Connected channels */}
      <section style={{ paddingTop: "var(--space-section)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <IconGrid size={13} className="text-text-tertiary" />
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Connected channels
          </p>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {model.channels.length > 0 ? (
            model.channels.map((channel) => (
              <span
                key={channel.label}
                style={{
                  borderRadius: "var(--radius-chip)",
                  padding: "4px 11px",
                  fontSize: 12,
                  fontWeight: 500,
                  background: channel.status === "connected" ? "var(--accent-green-bg)" : "var(--bg-disconnected)",
                  color: channel.status === "connected" ? "var(--accent-green-text)" : "var(--text-tertiary)",
                  border: channel.status === "connected"
                    ? "1px solid var(--accent-green-border)"
                    : "1px solid var(--border-default)",
                }}
              >
                {channel.label}
                {channel.detail ? (
                  <span style={{ opacity: 0.7, marginLeft: 4 }}>{channel.detail}</span>
                ) : null}
              </span>
            ))
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              No channels connected.{" "}
              <Link href="/dashboard/settings" style={{ color: "var(--accent-blue)", textDecoration: "none" }}>
                Connect in Settings →
              </Link>
            </p>
          )}
        </div>
      </section>
    </aside>
  );
}
