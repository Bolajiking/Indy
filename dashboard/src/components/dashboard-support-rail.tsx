"use client";

import type { DashboardHomeSupportRailModel } from "@/lib/dashboard-home";
import { formatDashboardDateTime } from "@/lib/datetime";
import { IconCard, IconChevronRight, IconGrid, IconPulse } from "./icons";

export function DashboardSupportRail({
  model,
}: {
  model: DashboardHomeSupportRailModel;
}) {
  return (
    <aside className="space-y-0">
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
          {model.opportunities.map((opp, i) => (
            <div
              key={`${opp.title}-${i}`}
              className="flex items-center justify-between transition-transform duration-150 hover:-translate-y-0.5"
              style={{
                padding: "12px 14px",
                borderRadius: "var(--radius-button)",
                background: i === 0 ? "var(--accent-blue-bg)" : "transparent",
                border: i === 0 ? "1px solid var(--accent-blue-border)" : "1px solid var(--border-default)",
              }}
            >
              <div className="min-w-0">
                <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
                  {opp.title}
                </p>
                {opp.stage ? (
                  <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "2px 0 0" }}>
                    {opp.stage}
                  </p>
                ) : null}
              </div>
              {opp.value ? (
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: i === 0 ? 700 : 600,
                    color: i === 0 ? "var(--accent-blue)" : "var(--text-primary)",
                  }}
                >
                  {opp.value}
                </span>
              ) : null}
            </div>
          ))}
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
