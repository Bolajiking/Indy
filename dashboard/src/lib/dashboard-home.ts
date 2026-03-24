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
  type DashboardPendingApproval,
  type DashboardPlatformConnection,
  type DashboardTransaction,
} from "./api";

export type { DashboardPendingApproval };

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
  cards: Array<{ label: string; value: string; detail: string; urgent?: boolean }>;
  /** Specific named action items the creator should act on today */
  urgentItems: Array<{ icon: string; text: string; href: string; badge?: string }>;
}

export interface DashboardHomeSupportRailModel {
  opportunities: Array<{ id: string; title: string; stage: string; value: string; fitScore: number | null }>;
  pendingActions: DashboardPendingApproval[];
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

export const EMPTY_AGENT_STATE: DashboardAgentState = {
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

  // Build specific named action items for the "Here's what's happening" section
  const urgentItems: DashboardHomeHeroModel["urgentItems"] = [];

  // Pending agent approvals — highest priority
  if (data.agentState.pendingApprovals.length > 0) {
    for (const action of data.agentState.pendingApprovals.slice(0, 2)) {
      urgentItems.push({
        icon: "⚡",
        text: action.description ?? `Agent action: ${action.type}`,
        href: "#agent-workspace",
        badge: "Approval needed",
      });
    }
    if (data.agentState.pendingApprovals.length > 2) {
      urgentItems.push({
        icon: "⚡",
        text: `+${data.agentState.pendingApprovals.length - 2} more actions waiting for approval`,
        href: "#agent-workspace",
        badge: "Approval needed",
      });
    }
  }

  // Deals that replied and need follow-up
  const respondedDeals = data.deals.filter((d) => d.stage === "responded");
  for (const deal of respondedDeals.slice(0, 2)) {
    urgentItems.push({
      icon: "📩",
      text: `${deal.brand_name} responded — review their message`,
      href: `/dashboard/deals#deal-${deal.id}`,
      badge: "Responded",
    });
  }

  // Deals in negotiation
  const negotiatingDeals = data.deals.filter((d) => d.stage === "negotiating");
  for (const deal of negotiatingDeals.slice(0, 1)) {
    urgentItems.push({
      icon: "🤝",
      text: `${deal.brand_name} — negotiation in progress`,
      href: `/dashboard/deals#deal-${deal.id}`,
      badge: "Negotiating",
    });
  }

  // Newly discovered opportunities
  const discoveredDeals = data.deals.filter((d) => d.stage === "discovered");
  for (const deal of discoveredDeals.slice(0, 2)) {
    urgentItems.push({
      icon: "✨",
      text: `New opportunity: ${deal.brand_name}${deal.fit_score != null ? ` · ${deal.fit_score}% fit` : ""}`,
      href: `/dashboard/deals#deal-${deal.id}`,
      badge: "Discovered",
    });
  }

  // Active deals (contracted / live)
  const activeDeals = data.deals.filter((d) => d.stage === "active" || d.stage === "contracted");
  for (const deal of activeDeals.slice(0, 1)) {
    urgentItems.push({
      icon: "🟢",
      text: `${deal.brand_name} deal is ${deal.stage}${deal.estimated_value_cents ? ` · ~${formatCurrency(deal.estimated_value_cents)}` : ""}`,
      href: `/dashboard/deals#deal-${deal.id}`,
    });
  }

  const hero: DashboardHomeHeroModel = {
    title: heroTitle,
    summary: heroSummary,
    primaryCta: approvalsCount > 0
      ? { label: "Review approvals", href: "#agent-workspace" }
      : { label: "Chat with Indyfren", href: "#agent-workspace" },
    secondaryCta: { label: "See pipeline", href: "/dashboard/deals" },
    urgentItems,
    cards: [
      {
        label: "Approvals",
        value: String(approvalsCount),
        detail: approvalsCount === 0 ? "Nothing waiting" : "waiting on you",
        urgent: approvalsCount > 0,
      },
      {
        label: "Follow-ups",
        value: String(followUpsCount),
        detail: followUpsCount === 0 ? "No active threads" : "deals in motion",
        urgent: followUpsCount > 0,
      },
      {
        label: "Pipeline",
        value: String(data.deals.length),
        detail: data.deals.length === 0 ? "No deals yet" : `${formatCurrency(pipelineValueCents)} est. value`,
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
    opportunities: data.deals.slice(0, 5).map((deal) => ({
      id: deal.id,
      title: deal.brand_name,
      stage: deal.stage,
      value: deal.estimated_value_cents ? formatCurrency(deal.estimated_value_cents) : "",
      fitScore: deal.fit_score,
    })),
    pendingActions: data.agentState.pendingApprovals,
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
