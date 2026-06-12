"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AgentHome } from "@/components/cf/agent-home";
import { useShell } from "@/components/cf/shell";
import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { useAuth } from "@/lib/auth-context";
import {
  clearPendingConnectionToolkit,
  readPendingConnection,
  writeRecentConnectionSuccess,
  type ConnectionOrigin,
} from "@/lib/connection-success";
import type { SettingsPane } from "@/components/cf/shell-context";

const SETTINGS_PANES: SettingsPane[] = [
  "account",
  "subscription",
  "wallet",
  "reports",
  "connections",
  "channels",
  "appearance",
  "referrals",
  "usage",
];

function isSettingsPane(value: string): value is SettingsPane {
  return SETTINGS_PANES.includes(value as SettingsPane);
}

function TodayInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { stage } = useAuth();
  const { openSettings } = useShell();
  const [initialQuery, setInitialQuery] = useState<string | undefined>(
    undefined,
  );
  const [resetKey, setResetKey] = useState(0);

  // Process the OAuth return synchronously on first render — before AgentHome
  // mounts — so chat connect cards pick up the success hint immediately.
  // Covers both callback shapes: Composio (?connected= / ?status=success /
  // ?connected_account_id=) and native platform OAuth (?oauth=success&platform=).
  const [oauthReturn] = useState<{
    connectedToolkit: string | null;
    origin: ConnectionOrigin;
    callbackPresent: boolean;
  }>(() => {
    const callbackSucceeded =
      searchParams.get("status") === "success" ||
      searchParams.has("connected_account_id") ||
      searchParams.get("oauth") === "success";
    const callbackPresent =
      callbackSucceeded ||
      searchParams.has("connected") ||
      searchParams.has("oauth");
    const pending = readPendingConnection();
    const connectedToolkit =
      searchParams.get("connected") ??
      (searchParams.get("oauth") === "success"
        ? searchParams.get("platform")
        : null) ??
      (callbackSucceeded ? (pending?.toolkit ?? null) : null);
    if (connectedToolkit) {
      writeRecentConnectionSuccess(connectedToolkit);
      clearPendingConnectionToolkit(connectedToolkit);
    }
    return {
      connectedToolkit,
      origin: pending?.origin ?? "settings",
      callbackPresent,
    };
  });

  useEffect(() => {
    const pane =
      searchParams.get("settings") ??
      (oauthReturn.callbackPresent ? "connections" : null);
    if (!pane || stage === "loading") {
      return;
    }

    if (
      (stage === "active" || stage === "wallet_pending") &&
      isSettingsPane(pane)
    ) {
      // Chat-initiated connects show success inline in the chat — don't yank
      // the creator into the Settings modal. Explicit ?settings= deep links
      // always open it.
      const implicitFromChat =
        !searchParams.get("settings") && oauthReturn.origin === "chat";
      if (!implicitFromChat) {
        openSettings(pane);
      }
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("settings");
    next.delete("connected");
    next.delete("status");
    next.delete("connected_account_id");
    next.delete("oauth");
    next.delete("platform");
    next.delete("error");
    const query = next.toString();
    router.replace(`/dashboard${query ? `?${query}` : ""}`);
  }, [oauthReturn, openSettings, router, searchParams, stage]);

  useEffect(() => {
    const q = searchParams.get("q");
    const isNew = searchParams.get("new");
    if (q) {
      setInitialQuery(decodeURIComponent(q));
      const next = new URLSearchParams(searchParams.toString());
      next.delete("q");
      const query = next.toString();
      router.replace(`/dashboard${query ? `?${query}` : ""}`);
      return;
    }
    if (isNew) {
      // Clear every creator-scoped chat cache (key form: indyfren_agent_cf_v1:<id>).
      try {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith("indyfren_agent_cf_v1")) {
            sessionStorage.removeItem(key);
          }
        }
      } catch {}
      setResetKey((k) => k + 1);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("new");
      const query = next.toString();
      router.replace(`/dashboard${query ? `?${query}` : ""}`);
      return;
    }
    try {
      const pending = sessionStorage.getItem("indyfren_pending_query");
      if (pending) {
        setInitialQuery(pending);
        sessionStorage.removeItem("indyfren_pending_query");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardAuthGate>
      <AgentHome key={resetKey} initialQuery={initialQuery} />
    </DashboardAuthGate>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <TodayInner />
    </Suspense>
  );
}
