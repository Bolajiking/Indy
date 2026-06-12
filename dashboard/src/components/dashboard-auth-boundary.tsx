"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { AuthProvider } from "@/lib/privy";
import { useAuth } from "@/lib/auth-context";
import { Ambient } from "@/components/cf/primitives";
import { CfTopNav } from "@/components/cf/top-nav";
import { ShellProvider } from "@/components/cf/shell";

function DashboardFrame({ children }: { children: ReactNode }) {
  const { stage } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const calm = pathname !== "/dashboard";
  const showNav = stage === "active" || stage === "wallet_pending";

  useEffect(() => {
    if (!showNav) return;

    router.prefetch("/dashboard");
    router.prefetch("/dashboard/deals");
    router.prefetch("/dashboard/wallet");
    router.prefetch("/dashboard/reports");
    router.prefetch("/dashboard/settings");
  }, [router, showNav]);

  return (
    <ShellProvider>
      <Ambient calm={calm} />
      {showNav && <CfTopNav />}
      <div className="app-content">{children}</div>
    </ShellProvider>
  );
}

export function DashboardAuthBoundary({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DashboardFrame>{children}</DashboardFrame>
    </AuthProvider>
  );
}
