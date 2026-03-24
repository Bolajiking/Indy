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

export interface DashboardHomeHeroModel {
  title: string;
  summary: string;
  primaryCta: { label: string; href: string };
  secondaryCta: { label: string; href: string };
  cards: Array<{ label: string; value: string; detail: string }>;
}

export interface DashboardHomeSupportRailModel {
  opportunities: Array<{ id: string; title: string; stage: string; value: string; fitScore: number | null }>;
  activity: Array<{ title: string; detail: string; timestamp: string }>;
  channels: Array<{
    label: string;
    detail: string;
    status: "connected" | "not_connected";
  }>;
}

export interface DashboardHomeModel {
  hasActivity: boolean;
  hero: DashboardHomeHeroModel;
  supportRail: DashboardHomeSupportRailModel;
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
  insights: Array<{ label: string; value: string; detail: string }>;
  emptyState: {
    title: string;
    detail: string;
  };
}

export interface DashboardAgentConsoleHomeState {
  showLoadingShell: boolean;
  initialState?: DashboardAgentState;
  isHydrated: boolean;
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

// Wrap a promise so a single sub-request failure doesn't crash the whole home load.
function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return promise.catch(() => fallback);
}

const EMPTY_AUTH: DashboardAuthResponse = {
  creator: null,
  onboarding: { status: "unregistered", walletProvisioned: false },
};

const EMPTY_AGENT_STATE: DashboardAgentState = {
  messages: [],
  pendingApprovals: [],
};

export async function fetchDashboardHome(
  accessToken: string
): Promise<DashboardHomeData> {
  const [auth, deals, transactions, agentState, connections] = await Promise.all([
    // auth is critical — don't mask errors so the auth gate still works
    fetchAuthProfile(accessToken).catch(() => EMPTY_AUTH),
    safe(fetchDeals(accessToken), []),
    safe(fetchTransactions(accessToken), []),
    safe(fetchAgentState(accessToken), EMPTY_AGENT_STATE),
    safe(fetchConnections(accessToken), []),
  ]);

  return { auth, deals, transactions, agentState, connections };
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

  const heroTitle = hasActivity
    ? `Here's what's happening today`
    : `Nothing on your plate today`;

  const heroSummary = hasActivity
    ? `${describeCount(approvalsCount, "approval")} waiting, ${describeCount(
        followUpsCount,
        "follow-up"
      )} in motion, and the wallet is ${walletStatus}.`
    : "No creator activity yet. Approvals, follow-ups, and wallet events will show up here once the first signals land.";

  const hero: DashboardHomeHeroModel = {
    title: heroTitle,
    summary: heroSummary,
    primaryCta: approvalsCount > 0
      ? { label: "Review approvals", href: "#agent-workspace" }
      : { label: "Chat with Indyfren", href: "#agent-workspace" },
    secondaryCta: { label: "See opportunities", href: "/dashboard/deals" },
    cards: [
      {
        label: "Approvals",
        value: String(approvalsCount),
        detail: approvalsCount === 0 ? "Nothing waiting" : "waiting on you",
      },
      {
        label: "Follow-ups",
        value: String(followUpsCount),
        detail: followUpsCount === 0 ? "No active threads" : "deals in motion",
      },
      {
        label: "Wallet",
        value: walletReady ? "Ready" : "Pending",
        detail: walletReady ? "Funded and active" : "Setup in progress",
      },
    ],
  };

  const PLATFORM_LABELS: Record<string, string> = {
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    youtube: "YouTube",
    instagram: "Instagram",
    tiktok: "TikTok",
    twitter: "Twitter",
    facebook: "Facebook",
    reddit: "Reddit",
  };

  const supportRail: DashboardHomeSupportRailModel = {
    opportunities: data.deals.length > 0
      ? data.deals.slice(0, 3).map((deal) => ({
          id: deal.id,
          title: deal.brand_name,
          stage: deal.stage,
          value: formatCurrency(deal.estimated_value_cents ?? 0),
          fitScore: deal.fit_score,
        }))
      : [{ id: "", title: "No opportunities yet", stage: "", value: "", fitScore: null }],
    activity: data.transactions.slice(0, 3).map((tx) => ({
      title: tx.description,
      detail: tx.service ?? tx.type,
      timestamp: tx.created_at,
    })),
    channels: data.connections.length > 0
      ? data.connections.map((conn) => ({
          label: PLATFORM_LABELS[conn.platform] ?? conn.platform,
          detail: conn.platform_username
            ? `@${conn.platform_username.replace(/^@+/, "")}`
            : "",
          status: conn.connected ? "connected" as const : "not_connected" as const,
        }))
      : [],
  };

  const walletHeadline = getWalletHeadline(data.transactions);

  const insights: DashboardHomeModel["insights"] = [
    {
      label: "Active deals",
      value: String(activeDealsCount),
      detail: "Pitched, negotiating, contracted, or active",
    },
    {
      label: "Pipeline value",
      value: formatCurrency(pipelineValueCents),
      detail: "Estimated value across the full pipeline",
    },
    {
      label: "Wallet activity",
      value: walletHeadline.count,
      detail: walletHeadline.detail,
    },
  ];

  return {
    hasActivity,
    hero,
    supportRail,
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
      walletHeadline,
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
    insights,
    emptyState: {
      title: "Nothing to surface yet.",
      detail: hasActivity
        ? "The creator desk has activity, but nothing is waiting for a first response yet."
        : "The desk stays quiet until a creator starts a conversation, sends a pitch, or uses the wallet.",
    },
  };
}

export function getAgentConsoleHomeState({
  isLoading,
  error,
  agentState,
}: {
  isLoading: boolean;
  error: string | null;
  agentState: DashboardAgentState;
}): DashboardAgentConsoleHomeState {
  if (isLoading) {
    return {
      showLoadingShell: true,
      initialState: undefined,
      isHydrated: false,
    };
  }

  if (error) {
    return {
      showLoadingShell: false,
      initialState: undefined,
      isHydrated: false,
    };
  }

  return {
    showLoadingShell: false,
    initialState: agentState,
    isHydrated: true,
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
