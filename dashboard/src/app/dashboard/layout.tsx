"use client";

import dynamic from "next/dynamic";
import { LegalFooter } from "@/components/legal-footer";

const DashboardAuthBoundary = dynamic(
  () =>
    import("@/components/dashboard-auth-boundary").then(
      (mod) => mod.DashboardAuthBoundary,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="app-content">
        <div className="page-wrap">
          <div className="page-inner">
            <div className="glass" style={{ padding: 32 }}>
              Opening your workspace...
            </div>
          </div>
        </div>
      </div>
    ),
  },
);

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <DashboardAuthBoundary>{children}</DashboardAuthBoundary>
      <LegalFooter />
    </>
  );
}
