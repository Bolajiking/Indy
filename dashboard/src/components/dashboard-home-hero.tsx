"use client";

import Link from "next/link";

import type { DashboardHomeHeroModel } from "@/lib/dashboard-home";
import { IconCheck, IconClock } from "./icons";

export function DashboardHomeHero({ model }: { model: DashboardHomeHeroModel }) {
  return (
    <section
      style={{
        background: "var(--gradient-hero)",
        borderRadius: "var(--radius-hero)",
        padding: "var(--space-hero-padding) 28px",
      }}
    >
      <h2
        style={{
          fontSize: 28,
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
          fontSize: 14,
          color: "var(--text-secondary)",
          margin: "0 0 20px",
          lineHeight: 1.5,
        }}
      >
        {model.summary}
      </p>
      <div className="flex gap-3">
        {model.primaryCta.href.startsWith("#") ? (
          <a
            href={model.primaryCta.href}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
            style={{
              background: "var(--accent-blue)",
              borderRadius: "var(--radius-button)",
              padding: "10px 20px",
            }}
          >
            <IconCheck size={14} />
            {model.primaryCta.label}
          </a>
        ) : (
          <Link
            href={model.primaryCta.href}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
            style={{
              background: "var(--accent-blue)",
              borderRadius: "var(--radius-button)",
              padding: "10px 20px",
            }}
          >
            <IconCheck size={14} />
            {model.primaryCta.label}
          </Link>
        )}
        <Link
          href={model.secondaryCta.href}
          className="flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:opacity-80"
          style={{
            border: "1.5px solid var(--border-light)",
            borderRadius: "var(--radius-button)",
            padding: "10px 20px",
            color: "var(--text-primary)",
          }}
        >
          <IconClock size={14} />
          {model.secondaryCta.label}
        </Link>
      </div>
    </section>
  );
}
