"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/lib/auth-context";

// Settings renders in the shell modal; this route exists for deep links and OAuth returns.
function SettingsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { stage } = useAuth();
  // Both callback shapes land here: Composio (?connected=) and native
  // platform OAuth (?oauth=success&platform=) — both belong in Connections.
  const isConnectionReturn =
    searchParams.has("connected") || searchParams.has("oauth");
  const targetPane = isConnectionReturn ? "connections" : "account";

  useEffect(() => {
    if (stage === "loading") {
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    next.set("settings", targetPane);
    router.replace(`/dashboard?${next.toString()}`);
  }, [router, searchParams, stage, targetPane]);

  return null;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsRedirect />
    </Suspense>
  );
}
