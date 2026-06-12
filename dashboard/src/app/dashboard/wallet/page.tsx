"use client";

import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { WalletPane } from "@/components/cf/panes/wallet-pane";

export default function WalletPage() {
  return (
    <DashboardAuthGate>
      <div className="page-wrap">
        <div className="page-inner">
          <WalletPane />
        </div>
      </div>
    </DashboardAuthGate>
  );
}
