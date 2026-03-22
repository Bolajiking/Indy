"use client";

import { useAuth } from "@/lib/privy";
import { TopNav } from "@/components/top-nav";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { creator, login, logout, stage } = useAuth();

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-canvas)" }}>
      <TopNav
        stage={stage}
        displayName={creator?.display_name ?? null}
        onLogin={login}
        onLogout={() => { void logout(); }}
      />
      <div
        className="mx-auto max-w-[1200px]"
        style={{ padding: "var(--space-page)" }}
      >
        {children}
      </div>
    </main>
  );
}
