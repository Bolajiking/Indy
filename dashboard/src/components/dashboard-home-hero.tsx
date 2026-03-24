"use client";

import Link from "next/link";

import type { DashboardHomeHeroModel } from "@/lib/dashboard-home";
import { IconCheck, IconClock } from "./icons";

export function DashboardHomeHero({ model }: { model: DashboardHomeHeroModel }) {
  const hasUrgent = model.urgentItems.length > 0;

  return (
    <section
      style={{
        background: "var(--gradient-hero)",
        borderRadius: "var(--radius-hero)",
        padding: "var(--space-hero-padding) 28px",
        border: hasUrgent ? "1px solid var(--accent-blue-border)" : "1px solid transparent",
      }}
    >
      {/* Title + summary */}
      <div style={{ marginBottom: hasUrgent ? 16 : 20 }}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "-0.4px",
            color: "var(--text-primary)",
            margin: "0 0 6px",
          }}
        >
          {model.title}
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {model.summary}
        </p>
      </div>

      {/* Urgent action items — shown when there is specific data to act on */}
      {hasUrgent && (
        <div
          style={{
            marginBottom: 20,
            borderRadius: "var(--radius-input)",
            border: "1px solid var(--border-default)",
            background: "var(--bg-canvas)",
            overflow: "hidden",
          }}
        >
          {model.urgentItems.map((item, i) => (
            <a
              key={i}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                textDecoration: "none",
                borderBottom: i < model.urgentItems.length - 1 ? "1px solid var(--border-default)" : "none",
                background: "transparent",
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1 }}>{item.icon}</span>
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: "var(--text-primary)",
                  fontWeight: 500,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.text}
              </span>
              {item.badge ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: 99,
                    background: item.badge === "Approval needed"
                      ? "var(--accent-pink-bg)"
                      : item.badge === "Responded"
                      ? "var(--accent-green-bg)"
                      : item.badge === "Negotiating"
                      ? "#fff3e0"
                      : "var(--accent-blue-bg)",
                    color: item.badge === "Approval needed"
                      ? "var(--accent-pink)"
                      : item.badge === "Responded"
                      ? "var(--accent-green-text)"
                      : item.badge === "Negotiating"
                      ? "#e65100"
                      : "var(--accent-blue)",
                    border: item.badge === "Approval needed"
                      ? "1px solid var(--accent-pink-border)"
                      : item.badge === "Responded"
                      ? "1px solid var(--accent-green-border)"
                      : item.badge === "Negotiating"
                      ? "1px solid #ffcc80"
                      : "1px solid var(--accent-blue-border)",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
              <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>→</span>
            </a>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        {model.cards.map((card) => (
          <div
            key={card.label}
            style={{
              flex: "1 1 80px",
              minWidth: 80,
              padding: "10px 14px",
              borderRadius: "var(--radius-card)",
              background: card.urgent ? "var(--accent-pink-bg)" : "var(--bg-canvas)",
              border: card.urgent
                ? "1px solid var(--accent-pink-border)"
                : "1px solid var(--border-default)",
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: card.urgent ? "var(--accent-pink)" : "var(--text-tertiary)",
                margin: "0 0 3px",
                textTransform: "uppercase",
                letterSpacing: "0.4px",
              }}
            >
              {card.label}
            </p>
            <p
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: card.urgent ? "var(--accent-pink)" : "var(--text-primary)",
                margin: "0 0 2px",
                letterSpacing: "-0.3px",
                lineHeight: 1,
              }}
            >
              {card.value}
            </p>
            <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: 0 }}>
              {card.detail}
            </p>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3">
        {model.primaryCta.href.startsWith("#") ? (
          <a
            href={model.primaryCta.href}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: "var(--accent-blue)",
              borderRadius: "var(--radius-button)",
              padding: "9px 18px",
            }}
          >
            <IconCheck size={13} />
            {model.primaryCta.label}
          </a>
        ) : (
          <Link
            href={model.primaryCta.href}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{
              background: "var(--accent-blue)",
              borderRadius: "var(--radius-button)",
              padding: "9px 18px",
            }}
          >
            <IconCheck size={13} />
            {model.primaryCta.label}
          </Link>
        )}
        <Link
          href={model.secondaryCta.href}
          className="flex items-center gap-1.5 text-[13px] font-medium transition-opacity hover:opacity-80"
          style={{
            border: "1.5px solid var(--border-light)",
            borderRadius: "var(--radius-button)",
            padding: "9px 18px",
            color: "var(--text-primary)",
          }}
        >
          <IconClock size={13} />
          {model.secondaryCta.label}
        </Link>
      </div>
    </section>
  );
}
