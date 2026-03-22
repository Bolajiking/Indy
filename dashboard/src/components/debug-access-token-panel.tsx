"use client";

import { useState } from "react";

interface DebugAccessTokenPanelProps {
  accessToken: string;
}

export function DebugAccessTokenPanel({
  accessToken,
}: DebugAccessTokenPanelProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(accessToken);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section className="rounded-[28px] border border-amber-950/15 bg-[linear-gradient(135deg,rgba(255,248,221,0.96),rgba(255,237,185,0.88))] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] text-amber-900/70" style={{ fontWeight: 600 }}>Development only</p>
          <h3 className="mt-2 text-3xl leading-none" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
            Privy access token
          </h3>
          <p className="mt-3 text-sm leading-7 text-amber-950/75">
            Use this only for local smoke checks like <code>npm run smoke:auth</code>.
            This token is sensitive and short-lived, so copy it, use it, and then rotate
            or discard it.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="text-xs font-semibold transition hover:opacity-90"
          style={{
            border: "1.5px solid var(--border-light)",
            borderRadius: "var(--radius-button)",
            padding: "10px 20px",
            color: "var(--text-primary)",
            background: "var(--bg-canvas)",
          }}
        >
          Copy token
        </button>
      </div>

      <div className="mt-5 rounded-[22px] border border-black/10 bg-black/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <code className="block max-h-44 overflow-auto break-all font-mono text-xs leading-6 text-amber-100/95">
          {accessToken}
        </code>
      </div>

      <p className="mt-4 text-xs text-amber-950/70">
        {copyState === "copied"
          ? "Copied to clipboard."
          : copyState === "failed"
            ? "Clipboard copy failed. You can still copy the token manually from the panel."
            : "This panel is shown only in local development while you are signed in."}
      </p>
    </section>
  );
}
