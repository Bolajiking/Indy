"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  getDashboardShellCopy,
  getDashboardShellStatusCopy,
  getSignedOutCopy,
} from "@/lib/consumer-copy";
import { useAuth } from "@/lib/privy";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/deals", label: "Deals" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [mountedPathname, setMountedPathname] = useState<string | null>(null);
  const { creator, error, login, logout, onboarding, stage, syncing } = useAuth();
  const shellCopy = getDashboardShellCopy();
  const signedOutCopy = getSignedOutCopy();

  useEffect(() => {
    setMountedPathname(pathname);
  }, [pathname]);

  const statusCopy = getDashboardShellStatusCopy({
    stage,
    creatorDisplayName: creator?.display_name ?? null,
    walletProvisioningInProgress: onboarding.walletProvisioningInProgress,
    walletProvisioningLastError: onboarding.walletProvisioningLastError ?? null,
  });

  return (
    <main
      suppressHydrationWarning
      className="min-h-screen px-4 py-4 md:px-6 md:py-6"
    >
      <div
        suppressHydrationWarning
        className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[280px_minmax(0,1fr)]"
      >
        <aside className="surface-card p-6 md:p-7">
          <div className="space-y-4">
            <div>
              <p className="eyebrow text-[11px] text-fog">{shellCopy.eyebrow}</p>
              <h1 className="display-title mt-3 text-4xl leading-none text-ink">
                {shellCopy.title}
              </h1>
            </div>
            <p className="text-sm leading-7 text-fog">{shellCopy.description}</p>
          </div>

          <nav className="mt-10 space-y-2">
            {navItems.map((item) => {
              const active = mountedPathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-2xl border px-4 py-4 text-sm font-semibold uppercase tracking-[0.18em] transition ${
                    active
                      ? "border-transparent bg-ink text-paper"
                      : "border-black/10 bg-white/45 text-ink hover:bg-white/70"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="surface-muted mt-10 p-4">
            <p className="eyebrow text-[11px] text-fog">Workspace status</p>
            <p className="mt-3 text-sm leading-7 text-ink">{statusCopy}</p>
            {error ? (
              <p className="mt-3 rounded-[18px] border border-blush/20 bg-white/70 px-3 py-3 text-xs leading-6 text-ink">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {stage === "signed_out" ? (
                <button
                  onClick={login}
                  className="cta-primary"
                >
                  {signedOutCopy.actionLabel}
                </button>
              ) : (
                <button
                  onClick={() => {
                    void logout();
                  }}
                  disabled={syncing}
                  className="cta-secondary disabled:opacity-50"
                >
                  {syncing ? "Signing out..." : "Sign out"}
                </button>
              )}
            </div>
          </div>
        </aside>

        <section className="space-y-6">{children}</section>
      </div>
    </main>
  );
}
