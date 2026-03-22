"use client";

import React, { useCallback } from "react";
import { IconSearch } from "./icons";

export function CommandBar() {
  const handleClick = useCallback(() => {
    const input = document.querySelector<HTMLTextAreaElement>(
      "#agent-console-input",
    );
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus();
    }
  }, []);

  return (
    <button
      onClick={handleClick}
      className="flex w-full items-center transition-all duration-150"
      style={{
        height: "var(--command-bar-height)",
        background: "var(--bg-input)",
        borderRadius: "var(--radius-input)",
        padding: "0 16px",
        border: "1.5px solid transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-default)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "transparent";
      }}
    >
      <IconSearch size={14} className="mr-2 text-text-placeholder" />
      <span
        className="flex-1 text-left"
        style={{ fontSize: 13, color: "var(--text-placeholder)" }}
      >
        Search or ask Indyfren anything...
      </span>
      <span
        style={{
          background: "var(--accent-pink-bg)",
          color: "var(--accent-pink)",
          fontSize: 11,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: "var(--radius-badge)",
        }}
      >
        ⌘K
      </span>
    </button>
  );
}
