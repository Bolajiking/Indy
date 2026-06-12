"use client";

import type { CSSProperties, ReactNode } from "react";

export function PageHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {eyebrow}
      </div>
      <h1 className="h-title" style={{ fontSize: 28 }}>
        {title}
      </h1>
      {sub && (
        <p className="h-sub" style={{ marginTop: 8, maxWidth: 560 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <div
      className="gcard"
      style={{ padding: "18px 22px", flex: 1, minWidth: 150 }}
    >
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: accent || "rgb(var(--ink))",
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{ fontSize: 12, color: "rgb(var(--ink) / 0.4)", marginTop: 4 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

type Tone = "info" | "warning" | "danger" | "success";
const TONE: Record<Tone, { bg: string; border: string; text: string }> = {
  info: {
    bg: "rgba(64,172,255,0.1)",
    border: "rgba(64,172,255,0.28)",
    text: "var(--cf-accent-blue)",
  },
  warning: {
    bg: "rgba(200,235,109,0.12)",
    border: "rgba(200,235,109,0.3)",
    text: "var(--cf-lime)",
  },
  danger: {
    bg: "rgba(255,107,107,0.12)",
    border: "rgba(255,107,107,0.3)",
    text: "var(--cf-coral)",
  },
  success: {
    bg: "rgba(64,255,204,0.12)",
    border: "rgba(64,255,204,0.28)",
    text: "var(--cf-grad-end)",
  },
};

export function Notice({
  tone = "info",
  title,
  children,
  style,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const t = TONE[tone];
  return (
    <div
      style={{
        border: `1px solid ${t.border}`,
        background: t.bg,
        borderRadius: 16,
        padding: "14px 16px",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: t.text,
            marginBottom: children ? 4 : 0,
          }}
        >
          {title}
        </div>
      )}
      {children && (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.55,
            color: "rgb(var(--ink) / 0.7)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({
  tone = "info",
  children,
}: {
  tone?: Tone | "neutral";
  children: ReactNode;
}) {
  const map: Record<string, { bg: string; text: string }> = {
    info: { bg: "rgba(64,172,255,0.14)", text: "var(--cf-accent-blue)" },
    success: { bg: "rgba(64,255,204,0.12)", text: "var(--cf-grad-end)" },
    warning: { bg: "rgba(200,235,109,0.14)", text: "var(--cf-lime)" },
    danger: { bg: "rgba(255,107,107,0.14)", text: "var(--cf-coral)" },
    neutral: { bg: "rgb(var(--ink) / 0.08)", text: "rgb(var(--ink) / 0.6)" },
  };
  const c = map[tone] ?? map.neutral;
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "4px 9px",
        borderRadius: 99,
        whiteSpace: "nowrap",
        background: c.bg,
        color: c.text,
      }}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: "22px 18px",
        borderRadius: 18,
        border: "1px dashed rgb(var(--ink) / 0.16)",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "rgb(var(--ink) / 0.7)",
          margin: "0 0 6px",
        }}
      >
        {title}
      </p>
      {detail && (
        <p
          style={{
            fontSize: 12.5,
            color: "rgb(var(--ink) / 0.5)",
            margin: "0 auto 10px",
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {detail}
        </p>
      )}
      {action}
    </div>
  );
}
