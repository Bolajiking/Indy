"use client";

import { DashboardAuthGate } from "@/components/dashboard-auth-gate";
import { ReportsPane } from "@/components/cf/panes/reports-pane";

export default function ReportsPage() {
  return (
    <DashboardAuthGate>
      <div className="page-wrap">
        <div className="page-inner">
          <ReportsPane />
        </div>
      </div>
    </DashboardAuthGate>
  );
}
