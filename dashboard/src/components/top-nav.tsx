"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBarChart,
  IconCard,
  IconClock,
  IconDocument,
  IconGear,
} from "./icons";

const navItems = [
  { href: "/dashboard", label: "Today", icon: IconClock, exact: true },
  { href: "/dashboard/deals", label: "Deals", icon: IconCard, exact: false },
  { href: "/dashboard/wallet", label: "Wallet", icon: IconDocument, exact: false },
  { href: "/dashboard/reports", label: "Reports", icon: IconBarChart, exact: false },
  { href: "/dashboard/settings", label: "Settings", icon: IconGear, exact: false },
];

interface TopNavProps {
  stage: "loading" | "signed_out" | "unregistered" | "onboarding" | "wallet_pending" | "active";
  displayName: string | null;
  onLogin: () => void;
  onLogout: () => void;
}

export function TopNav({ stage, displayName, onLogin, onLogout }: TopNavProps) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav
      className="flex items-center justify-between border-b px-4 md:px-8"
      style={{
        height: "var(--nav-height, 52px)",
        borderColor: "var(--border-default)",
        minWidth: 0,
      }}
    >
      {/* Left: logo + tabs */}
      <div className="flex items-center gap-3 md:gap-6 min-w-0 flex-1">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
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
            className="font-bold hidden sm:block"
            style={{
              fontSize: 15,
              letterSpacing: "-0.3px",
              color: "var(--text-primary)",
            }}
          >
            indyfren
          </span>
        </div>

        {/* Tabs — scrollable on mobile */}
        <div
          className="flex gap-0.5 min-w-0"
          style={{ overflowX: "auto", scrollbarWidth: "none" }}
        >
          {navItems.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1 transition-colors duration-150 whitespace-nowrap shrink-0"
                style={{
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active
                    ? "var(--accent-pink)"
                    : "var(--text-secondary)",
                  background: active
                    ? "var(--accent-pink-bg)"
                    : "transparent",
                  padding: "6px 10px",
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

      {/* Right: auth actions */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {stage === "signed_out" ? (
          <button
            onClick={onLogin}
            className="text-[13px] font-semibold text-white transition-colors duration-150 hover:opacity-90 whitespace-nowrap"
            style={{
              background: "var(--accent-blue)",
              padding: "8px 12px",
              borderRadius: "var(--radius-button)",
            }}
          >
            Sign in
          </button>
        ) : (
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center justify-center transition-transform duration-150 hover:scale-105"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #2D7CF6, #6BA3FF)",
              }}
              aria-label="Profile menu"
            >
              <span className="text-[12px] font-semibold text-white">
                {(displayName ?? "?")[0].toUpperCase()}
              </span>
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 top-full mt-2 z-50 py-1"
                style={{
                  minWidth: 160,
                  borderRadius: "var(--radius-card)",
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-surface)",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                }}
              >
                <div
                  className="px-3 py-2 border-b"
                  style={{ borderColor: "var(--border-default)" }}
                >
                  <p
                    className="text-[13px] font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {displayName ?? "Creator"}
                  </p>
                </div>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setProfileOpen(false)}
                  className="block px-3 py-2 text-[13px] transition-colors hover:opacity-80"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Settings
                </Link>
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-3 py-2 text-[13px] transition-colors hover:opacity-80"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
