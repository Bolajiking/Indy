"use client";

import React from "react";

export interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

export function Tooltip({ label, children }: TooltipProps) {
  return (
    <div className="group" style={{ position: "relative", display: "inline-flex" }}>
      {children}
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 translate-y-1 whitespace-nowrap opacity-0 transition-all duration-150 ease-out group-hover:-translate-y-0 group-hover:opacity-100"
        style={{
          background: "#1a1a2e",
          color: "#fff",
          fontSize: "11px",
          fontWeight: 500,
          padding: "5px 10px",
          borderRadius: "6px",
          marginBottom: "8px",
        }}
      >
        {label}
        <span
          className="absolute left-1/2 top-full -translate-x-1/2"
          style={{
            borderWidth: "4px",
            borderStyle: "solid",
            borderColor: "#1a1a2e transparent transparent transparent",
          }}
        />
      </span>
    </div>
  );
}
