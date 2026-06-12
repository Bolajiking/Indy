"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/cf/primitives";

const CHAT_TABS = [
  {
    label: "Find brand deals",
    prompt:
      "Find me brand deals for a wellness creator with 80K followers on Instagram",
  },
  {
    label: "Draft a pitch",
    prompt:
      "Draft a cold pitch email to Athletic Greens for a sponsored YouTube video",
  },
  {
    label: "What should I charge?",
    prompt:
      "What should I charge for a dedicated integration on a YouTube video with 95K avg views?",
  },
  {
    label: "Plan my day",
    prompt:
      "Give me a morning brief — what should I prioritize today based on my pipeline?",
  },
];

export function LandingComposer() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [draft, setDraft] = useState(CHAT_TABS[0].prompt);
  const [loading, setLoading] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || loading) return;

    setLoading(true);
    try {
      sessionStorage.setItem("indyfren_pending_query", text);
    } catch {}
    router.push(`/dashboard?login=1&q=${encodeURIComponent(text)}`);
  }

  return (
    <div className="glass" style={{ padding: 18, borderRadius: 28 }}>
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}
      >
        {CHAT_TABS.map((item, index) => (
          <button
            key={item.label}
            className="chip"
            data-sel={tab === index}
            onClick={() => {
              setTab(index);
              setDraft(item.prompt);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(event);
            }
          }}
          rows={3}
          placeholder="Ask Indyfren anything about your creator business..."
          style={{
            width: "100%",
            resize: "none",
            background: "rgb(var(--ink) / 0.05)",
            border: "1px solid rgb(var(--ink) / 0.08)",
            borderRadius: 16,
            color: "rgb(var(--ink))",
            fontSize: 15,
            padding: "14px 16px",
            outline: "none",
            lineHeight: 1.6,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            marginTop: 12,
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              color: "rgb(var(--ink) / 0.45)",
              flex: "1 1 180px",
              minWidth: 0,
            }}
          >
            Free to start · $10 in credits · no card
          </span>
          <button
            type="submit"
            className="dark-pill dark-pill--solid"
            style={{ height: 46, whiteSpace: "nowrap", marginLeft: "auto" }}
            disabled={loading || !draft.trim()}
          >
            {loading ? "One sec..." : "Ask Indyfren"}{" "}
            {Icon.arrowR({ size: 15, color: "#fff" })}
          </button>
        </div>
      </form>
    </div>
  );
}
