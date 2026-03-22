import {
  ACTIVE_STAGES,
  fetchAuthProfile,
  fetchAgentState,
  fetchConnections,
  fetchDeals,
  fetchTransactions,
  formatCurrency,
  getDealsStageCounts,
  getWalletHeadline,
  type DashboardAgentState,
  type DashboardAuthResponse,
  type DashboardDeal,
  type DashboardPlatformConnection,
  type DashboardTransaction,
} from "./api";

const FOLLOW_UP_STAGES = new Set(["pitched", "responded", "negotiating"]);

export interface DashboardHomeData {
  auth: DashboardAuthResponse;
  deals: DashboardDeal[];
  transactions: DashboardTransaction[];
  agentState: DashboardAgentState;
  connections: DashboardPlatformConnection[];
}

export interface DashboardHomeModel {
  hasActivity: boolean;
  todayHero: {
    summary: string;
    approvalsCount: number;
    followUpsCount: number;
    walletReady: boolean;
  };
  status: {
    detail: string;
  };
  stats: {
    totalDeals: number;
    activeDealsCount: number;
    pipelineValueLabel: string;
    walletHeadline: {
      count: string;
      detail: string;
    };
  };
  stageCounts: Record<string, number>;
  recentDeals: Array<{
    id: string;
    brandName: string;
    stage: string;
    valueLabel: string;
    fitScoreLabel: string;
    notes: string;
  }>;
  emptyState: {
    title: string;
    detail: string;
  };
}

export const EMPTY_HOME_DATA: DashboardHomeData = {
  auth: {
    creator: null,
    onboarding: {
      status: "unregistered",
      walletProvisioned: false,
    },
  },
  deals: [],
  transactions: [],
  agentState: {
    messages: [],
    pendingApprovals: [],
  },
  connections: [],
};

export async function fetchDashboardHome(
  accessToken: string
): Promise<DashboardHomeData> {
  const [auth, deals, transactions, agentState, connections] = await Promise.all([
    fetchAuthProfile(accessToken),
    fetchDeals(accessToken),
    fetchTransactions(accessToken),
    fetchAgentState(accessToken),
    fetchConnections(accessToken),
  ]);

  return {
    auth,
    deals,
    transactions,
    agentState,
    connections,
  };
}

export function buildDashboardHomeModel(data: DashboardHomeData): DashboardHomeModel {
  const approvalsCount = data.agentState.pendingApprovals.length;
  const followUpsCount = data.deals.filter((deal) => FOLLOW_UP_STAGES.has(deal.stage)).length;
  const hasActivity =
    data.deals.length > 0 ||
    data.transactions.length > 0 ||
    data.agentState.messages.length > 0 ||
    approvalsCount > 0 ||
    data.connections.length > 0;
  const walletReady =
    data.auth.onboarding.walletProvisioned || data.auth.onboarding.status === "active";
  const walletStatus = getWalletStatusLabel(data.auth.onboarding, walletReady);
  const stageCounts = getDealsStageCounts(data.deals);
  const activeDealsCount = data.deals.filter((deal) => ACTIVE_STAGES.includes(deal.stage)).length;
  const pipelineValueCents = data.deals.reduce(
    (sum, deal) => sum + (deal.estimated_value_cents ?? 0),
    0
  );

  return {
    hasActivity,
    todayHero: {
      summary: hasActivity
        ? `${describeCount(approvalsCount, "approval")}, ${describeCount(
            followUpsCount,
            "follow-up"
          )}, and the wallet is ${walletStatus}.`
        : "No creator activity yet. Approvals, follow-ups, and wallet events will show up here once the first signals land.",
      approvalsCount,
      followUpsCount,
      walletReady,
    },
    status: hasActivity
      ? {
          detail: walletReady
            ? "Approvals, follow-ups, and wallet events are all flowing through the same home view."
            : "The creator desk is active, but wallet-backed actions still need setup to finish.",
        }
      : {
          detail:
            "No approvals, follow-ups, connections, or wallet events have landed yet.",
        },
    stats: {
      totalDeals: data.deals.length,
      activeDealsCount,
      pipelineValueLabel: formatCurrency(pipelineValueCents),
      walletHeadline: getWalletHeadline(data.transactions),
    },
    stageCounts,
    recentDeals: data.deals.slice(0, 4).map((deal) => ({
      id: deal.id,
      brandName: deal.brand_name,
      stage: deal.stage,
      valueLabel: formatCurrency(deal.estimated_value_cents ?? 0),
      fitScoreLabel:
        deal.fit_score == null ? "Fit score n/a" : `Fit score ${deal.fit_score}`,
      notes: deal.notes?.trim() || "No notes yet.",
    })),
    emptyState: {
      title: "Nothing to surface yet.",
      detail: hasActivity
        ? "The creator desk has activity, but nothing is waiting for a first response yet."
        : "The desk stays quiet until a creator starts a conversation, sends a pitch, or uses the wallet.",
    },
  };
}

function describeCount(count: number, label: string) {
  return count === 0 ? `No ${label}s` : `${count} ${label}${count === 1 ? "" : "s"}`;
}

function getWalletStatusLabel(
  onboarding: DashboardAuthResponse["onboarding"],
  walletReady: boolean
) {
  if (walletReady) {
    return "ready";
  }

  if (onboarding.walletProvisioningInProgress) {
    return "still in progress";
  }

  if (onboarding.walletProvisioningLastError) {
    return "needs a retry";
  }

  return "still being set up";
}
