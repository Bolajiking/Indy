"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBell,
  IconBarChart,
  IconCard,
  IconClock,
  IconDocument,
  IconGear,
  IconSearch,
} from "./icons";
import { Tooltip } from "./tooltip";

const navItems = [
  { href: "/dashboard", label: "Today", icon: IconClock },
  { href: "/dashboard/deals", label: "Deals", icon: IconCard },
  { href: "/dashboard/wallet", label: "Wallet", icon: IconDocument },
  { href: "/dashboard/reports", label: "Reports", icon: IconBarChart },
  { href: "/dashboard/settings", label: "Settings", icon: IconGear },
];

interface TopNavProps {
  stage: "loading" | "signed_out" | "unregistered" | "registering" | "wallet_pending" | "active";
  displayName: string | null;
  onLogin: () => void;
  onLogout: () => void;
}

export function TopNav({ stage, displayName, onLogin, onLogout }: TopNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center justify-between border-b px-8"
      style={{
        height: "var(--nav-height)",
        borderColor: "var(--border-default)",
      }}
    >
      {/* Left: logo + tabs */}
      <div className="flex items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--radius-logo)",
              background: "linear-gradient(135deg, #FF2D78, #FF6B9D)",
            }}
          >
            <span className="text-[13px] font-bold text-white">i</span>
          </div>
          <span
            className="font-bold"
            style={{
              fontSize: 15,
              letterSpacing: "-0.3px",
              color: "var(--text-primary)",
            }}
          >
            indyfren
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1 transition-colors duration-150"
                style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active
                    ? "var(--accent-pink)"
                    : "var(--text-secondary)",
                  background: active
                    ? "var(--accent-pink-bg)"
                    : "transparent",
                  padding: "6px 16px",
                  borderRadius: "var(--radius-chip)",
                }}
              >
                <Icon size={14} />
                <span className="hidden md:inline">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <Tooltip label="Notifications">
          <button
            className="flex items-center justify-center transition-transform duration-150 hover:scale-105"
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-button)",
              background: "var(--bg-input)",
            }}
          >
            <IconBell className="text-text-secondary" />
          </button>
        </Tooltip>

        <Tooltip label="Search ⌘K">
          <button
            className="flex items-center justify-center transition-transform duration-150 hover:scale-105"
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-button)",
              background: "var(--bg-input)",
            }}
          >
            <IconSearch className="text-text-secondary" />
          </button>
        </Tooltip>

        {stage === "signed_out" ? (
          <button
            onClick={onLogin}
            className="text-[13px] font-semibold text-white transition-colors duration-150 hover:opacity-90"
            style={{
              background: "var(--accent-blue)",
              padding: "8px 16px",
              borderRadius: "var(--radius-button)",
            }}
          >
            Sign in
          </button>
        ) : (
          <Tooltip label={`${displayName ?? "Profile"} — Profile`}>
            <button
              className="flex items-center justify-center transition-transform duration-150 hover:scale-105"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background:
                  "linear-gradient(135deg, #2D7CF6, #6BA3FF)",
              }}
            >
              <span className="text-[12px] font-semibold text-white">
                {(displayName ?? "?")[0].toUpperCase()}
              </span>
            </button>
          </Tooltip>
        )}
      </div>
    </nav>
  );
}
