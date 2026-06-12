"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { useAuthedQuery } from "@/lib/use-authed-query";
import {
  fetchAgentState,
  fetchDeals,
  type DashboardAgentState,
} from "@/lib/api";
import { useTheme } from "./theme";
import { useShell } from "./shell-context";
import { Icon, Logo } from "./primitives";

const NAV: Array<[string, string, boolean]> = [
  ["/dashboard", "Today", true],
  ["/dashboard/deals", "Deals", false],
];

const EMPTY_AGENT_STATE: DashboardAgentState = {
  messages: [],
  pendingApprovals: [],
};

function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface NotificationItem {
  key: string;
  title: string;
  detail: string;
  time: string;
  dot: string;
  href: string;
}

// Keep the bell quiet unless the signed-in creator has actionable activity.
function Notifications() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: agentState } = useAuthedQuery(
    fetchAgentState,
    EMPTY_AGENT_STATE,
    "indyfren_agent_v1",
  );
  const { data: deals } = useAuthedQuery(fetchDeals, [], "indyfren_deals_v1");

  const items: NotificationItem[] = [];
  for (const approval of agentState.pendingApprovals) {
    items.push({
      key: `appr-${approval.id}`,
      title: "Approval waiting",
      detail: approval.description,
      time: "",
      dot: "var(--cf-accent-blue)",
      href: "/dashboard",
    });
  }
  for (const deal of deals) {
    if (deal.stage === "responded") {
      items.push({
        key: `replied-${deal.id}`,
        title: `${deal.brand_name} replied`,
        detail: deal.response_text || "Wants to move forward — reply ready.",
        time: relativeTime(deal.responded_at ?? deal.updated_at),
        dot: "var(--cf-grad-end)",
        href: "/dashboard/deals",
      });
    } else if (deal.stage === "discovered") {
      items.push({
        key: `match-${deal.id}`,
        title: "New brand match",
        detail: `${deal.brand_name}${deal.fit_score != null ? ` · ${deal.fit_score}% fit` : ""}`,
        time: relativeTime(deal.created_at),
        dot: "var(--cf-periwinkle)",
        href: "/dashboard/deals",
      });
    }
  }
  const shown = items.slice(0, 8);
  const hasItems = shown.length > 0;

  return (
    <div style={{ position: "relative" }}>
      <button
        className="icon-btn"
        data-active={open}
        title="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        {Icon.bell({ size: 18 })}
        {hasItems && (
          <span
            style={{
              position: "absolute",
              top: 9,
              right: 10,
              width: 8,
              height: 8,
              borderRadius: 99,
              background: "var(--cf-grad-end)",
              border: "2px solid rgba(0,0,0,0.2)",
            }}
          />
        )}
      </button>
      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 55 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="pop fade"
            style={{
              position: "absolute",
              top: 56,
              right: 0,
              width: 330,
              padding: 8,
            }}
          >
            <div className="pop-label">Notifications</div>
            {hasItems ? (
              shown.map((n) => (
                <button
                  key={n.key}
                  className="pop-item"
                  style={{ alignItems: "flex-start" }}
                  onClick={() => {
                    setOpen(false);
                    router.push(n.href);
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 99,
                      background: n.dot,
                      marginTop: 6,
                      flex: "none",
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{n.title}</span>
                      {n.time && (
                        <span
                          style={{
                            fontSize: 12,
                            color: "rgb(var(--ink) / 0.4)",
                            fontWeight: 500,
                          }}
                        >
                          {n.time}
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "rgb(var(--ink) / 0.55)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {n.detail}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div
                style={{
                  padding: "18px 13px",
                  fontSize: 13,
                  color: "rgb(var(--ink) / 0.5)",
                  textAlign: "center",
                }}
              >
                You&apos;re all caught up.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ProfileMenu({ displayName }: { displayName: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { theme, toggle } = useTheme();
  const { openSettings } = useShell();
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  const initial = (displayName ?? "?")[0]?.toUpperCase() ?? "?";
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="avatar-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Profile menu"
      >
        {initial}
      </button>
      {open && (
        <div
          className="pop fade"
          style={{
            position: "absolute",
            top: 52,
            right: 0,
            width: 210,
            padding: 8,
          }}
        >
          <div
            style={{
              padding: "6px 12px 10px",
              borderBottom: "1px solid rgb(var(--ink) / 0.08)",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "rgb(var(--ink))",
              }}
            >
              {displayName ?? "Creator"}
            </div>
          </div>
          <button
            className="pop-item"
            onClick={() => {
              setOpen(false);
              openSettings("account");
            }}
          >
            {Icon.user({ size: 17, color: "rgb(var(--ink) / 0.7)" })} Account
          </button>
          <button
            className="pop-item"
            onClick={() => {
              setOpen(false);
              openSettings("subscription");
            }}
          >
            {Icon.card({ size: 17, color: "rgb(var(--ink) / 0.7)" })}{" "}
            Subscription
          </button>
          <button
            className="pop-item"
            onClick={() => {
              setOpen(false);
              toggle();
            }}
          >
            {theme === "dark"
              ? Icon.sun({ size: 17, color: "rgb(var(--ink) / 0.7)" })
              : Icon.moon({ size: 17, color: "rgb(var(--ink) / 0.7)" })}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="pop-sep" />
          <button
            className="pop-item"
            onClick={() => {
              setOpen(false);
              openSettings("usage");
            }}
          >
            {Icon.logout({ size: 17, color: "rgb(var(--ink) / 0.7)" })} Settings
          </button>
        </div>
      )}
    </div>
  );
}

export function CfTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { creator } = useAuth();
  const { openSettings, toggleLibrary, libraryOpen, setLibrary } = useShell();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href && !libraryOpen : pathname.startsWith(href);

  function onLibrary() {
    if (pathname !== "/dashboard") {
      router.push("/dashboard");
      setLibrary(true);
    } else {
      toggleLibrary();
    }
  }

  return (
    <div className="topnav">
      <button
        className="pill-btn"
        onClick={() => {
          setLibrary(false);
          router.push("/dashboard");
        }}
        style={{ paddingRight: 16 }}
      >
        <Logo size={16} />
      </button>

      <div className="nav-seg">
        {NAV.map(([href, label, exact]) => (
          <Link
            key={href}
            href={href}
            className="nav-seg-btn"
            data-active={isActive(href, exact)}
            onClick={() => setLibrary(false)}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="nav-actions">
        <button
          className="icon-btn"
          title="New chat"
          onClick={() => {
            setLibrary(false);
            router.push("/dashboard?new=1");
          }}
        >
          {Icon.newchat({ size: 18 })}
        </button>
        <button className="icon-btn nav-hide-sm" title="Help">
          {Icon.help({ size: 18 })}
        </button>
        <button
          className="icon-btn"
          title="App library"
          data-active={libraryOpen}
          onClick={onLibrary}
        >
          {Icon.grid({ size: 18 })}
        </button>
        <Notifications />
        <button
          className="icon-btn nav-hide-sm"
          title="Settings"
          onClick={() => openSettings("account")}
        >
          {Icon.gear({ size: 18 })}
        </button>
        <ProfileMenu displayName={creator?.display_name ?? null} />
      </div>
    </div>
  );
}
