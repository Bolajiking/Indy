export interface DashboardDeal {
  id: string;
  brand_name: string;
  brand_contact_email: string | null;
  brand_contact_name: string | null;
  stage: string;
  fit_score: number | null;
  estimated_value_cents: number | null;
  actual_value_cents: number | null;
  pitch_text: string | null;
  pitch_sent_at: string | null;
  response_text: string | null;
  responded_at: string | null;
  contract_notes: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DashboardTransaction {
  id: string;
  type: string;
  amount_cents: number;
  currency: string;
  description: string;
  service: string | null;
  created_at: string;
}

export interface DashboardCreator {
  id: string;
  display_name: string;
  niche: string | null;
  wallet_id: string | null;
  wallet_address: string | null;
  privy_user_id: string | null;
  telegram_chat_id: string | null;
  whatsapp_phone: string | null;
  settings: Record<string, unknown> | null;
}

export interface DashboardOnboardingState {
  status: string;
  walletProvisioned: boolean;
  walletProvisioningInProgress?: boolean;
  walletProvisioningAttempts?: number;
  walletProvisioningLastError?: string | null;
  onboardingComplete?: boolean;
}

export interface OnboardingContextInput {
  platforms: string[];
  followerRange: string;
  currentRateUsd?: number;
  monthlyTargetUsd?: number;
  goals: string[];
  experienceLevel: string;
}

export interface DashboardAuthResponse {
  creator: DashboardCreator | null;
  onboarding: DashboardOnboardingState;
}

export interface DashboardRegistrationInput {
  displayName: string;
  niche?: string;
}

export interface DashboardProfileUpdateInput {
  displayName?: string;
  niche?: string;
  settings?: Record<string, unknown>;
}

export interface DashboardPlatformConnection {
  platform: string;
  platform_username: string | null;
  connected: boolean;
}

export interface DashboardPlatformConnectionInput {
  platform: string;
  accessToken: string;
  username?: string;
  refreshToken?: string;
  userId?: string;
  expiresAt?: string;
}

export interface DashboardMessagingLink {
  platform: "telegram" | "whatsapp";
  token: string;
  expiresAt: string;
  command: string;
  launchUrl: string | null;
}

export interface DashboardPlatformOAuthProvider {
  platform: string;
  enabled: boolean;
  authorizationUrl: string;
  scope: string;
}

export interface DashboardMessage {
  id: string;
  creator_id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardPendingApproval {
  id: string;
  creatorId: string;
  actionId: string;
  type: string;
  description: string;
  preview: string;
  input: Record<string, unknown>;
}

export interface DashboardAgentReply {
  text: string;
  requiresApproval: boolean;
  pendingAction?: {
    id: string;
    type: string;
    description: string;
    input: Record<string, unknown>;
  };
}

export interface DashboardAgentState {
  messages: DashboardMessage[];
  pendingApprovals: DashboardPendingApproval[];
}

export interface DashboardAgentMessageResponse extends DashboardAgentState {
  reply: DashboardAgentReply;
}

export interface DashboardAgentApprovalResponse {
  execution?: {
    message: string;
    costCents?: number;
  };
  pendingApprovals: DashboardPendingApproval[];
}

export interface FinancialSnapshot {
  creatorId: string;
  period: string;
  income: { totalCents: number; bySource: Record<string, number> };
  expenses: { totalCents: number; agentSpendCents: number; byCategory: Record<string, number> };
  netCents: number;
  pipeline: { activeDealCount: number; totalPipelineValueCents: number };
  forecast: { nextMonthEstimateCents: number; confidence: string };
}

export interface AggregatedAnalytics {
  creatorId: string;
  collectedAt: string;
  platforms: Array<{
    platform: string;
    username: string;
    followers?: number;
    engagementRate?: number;
    error?: string;
  }>;
  totalFollowers: number;
  avgEngagementRate: number;
}

export const DEAL_STAGE_ORDER: string[] = [
  "discovered",
  "pitched",
  "responded",
  "negotiating",
  "contracted",
  "active",
  "completed",
  "lost",
];

export const ACTIVE_STAGES: string[] = [
  "pitched",
  "responded",
  "negotiating",
  "contracted",
  "active",
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const PROXY_BASE = "/api/proxy";

export async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function toProxyPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${PROXY_BASE}${normalized}`;
}

async function parseProxyResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Ignore parse failures and preserve the generic message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function fetchAuthedJson<T>(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(toProxyPath(path), {
    ...init,
    headers,
    cache: "no-store",
  });

  return parseProxyResponse<T>(response);
}

export async function fetchAuthProfile(accessToken: string): Promise<DashboardAuthResponse> {
  return fetchAuthedJson<DashboardAuthResponse>("/api/auth/me", accessToken);
}

export async function registerCreatorProfile(
  accessToken: string,
  input: DashboardRegistrationInput
): Promise<DashboardAuthResponse> {
  return fetchAuthedJson<DashboardAuthResponse>("/api/auth/register", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateCreatorProfile(
  accessToken: string,
  input: DashboardProfileUpdateInput
): Promise<DashboardAuthResponse> {
  return fetchAuthedJson<DashboardAuthResponse>("/api/auth/me", accessToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function retryCreatorWalletProvisioning(
  accessToken: string
): Promise<DashboardAuthResponse> {
  return fetchAuthedJson<DashboardAuthResponse>("/api/auth/me/wallet/retry", accessToken, {
    method: "POST",
  });
}

export async function saveOnboardingContext(
  accessToken: string,
  input: OnboardingContextInput
): Promise<DashboardAuthResponse> {
  return fetchAuthedJson<DashboardAuthResponse>("/api/auth/onboarding", accessToken, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchDeals(accessToken: string): Promise<DashboardDeal[]> {
  return fetchAuthedJson<DashboardDeal[]>("/api/deals", accessToken);
}

export async function patchDealStage(
  accessToken: string,
  dealId: string,
  stage: string
): Promise<DashboardDeal> {
  return fetchAuthedJson<DashboardDeal>(`/api/deals/${dealId}/stage`, accessToken, {
    method: "PATCH",
    body: JSON.stringify({ stage }),
  });
}

export async function fetchTransactions(accessToken: string): Promise<DashboardTransaction[]> {
  return fetchAuthedJson<DashboardTransaction[]>(
    "/api/wallet/transactions?limit=20",
    accessToken
  );
}

export interface DashboardWalletBalance {
  balanceCents: number;
  balanceFormatted: string;
  walletAddress: string | null;
  error?: string;
}

export async function fetchWalletBalance(accessToken: string): Promise<DashboardWalletBalance> {
  return fetchAuthedJson<DashboardWalletBalance>("/api/wallet/balance", accessToken);
}

export async function fetchAgentState(
  accessToken: string
): Promise<DashboardAgentState> {
  return fetchAuthedJson<DashboardAgentState>("/api/agent/state", accessToken);
}

export async function sendAgentMessage(
  accessToken: string,
  text: string
): Promise<DashboardAgentMessageResponse> {
  return fetchAuthedJson<DashboardAgentMessageResponse>("/api/agent/messages", accessToken, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function approveAgentAction(
  accessToken: string,
  actionId: string
): Promise<DashboardAgentApprovalResponse> {
  return fetchAuthedJson<DashboardAgentApprovalResponse>(
    `/api/agent/approvals/${actionId}/approve`,
    accessToken,
    { method: "POST" }
  );
}

export async function skipAgentAction(
  accessToken: string,
  actionId: string
): Promise<DashboardAgentApprovalResponse> {
  return fetchAuthedJson<DashboardAgentApprovalResponse>(
    `/api/agent/approvals/${actionId}/skip`,
    accessToken,
    { method: "POST" }
  );
}

export async function fetchConnections(
  accessToken: string
): Promise<DashboardPlatformConnection[]> {
  return fetchAuthedJson<DashboardPlatformConnection[]>("/api/platforms", accessToken);
}

export async function fetchPlatformOAuthProviders(
  accessToken: string
): Promise<DashboardPlatformOAuthProvider[]> {
  return fetchAuthedJson<DashboardPlatformOAuthProvider[]>(
    "/api/platforms/oauth/providers",
    accessToken
  );
}

export async function createMessagingLink(
  accessToken: string,
  platform: "telegram" | "whatsapp"
): Promise<DashboardMessagingLink> {
  return fetchAuthedJson<DashboardMessagingLink>(
    `/api/messaging-links/${platform}`,
    accessToken,
    { method: "POST" }
  );
}

export async function fetchFinancial(
  accessToken: string
): Promise<FinancialSnapshot | null> {
  return fetchAuthedJson<FinancialSnapshot | null>("/api/reports/financial", accessToken);
}

export async function fetchAnalytics(
  accessToken: string
): Promise<AggregatedAnalytics | null> {
  return fetchAuthedJson<AggregatedAnalytics | null>("/api/reports/analytics", accessToken);
}

export async function connectPlatform(
  accessToken: string,
  input: DashboardPlatformConnectionInput
): Promise<DashboardPlatformConnection> {
  return fetchAuthedJson<DashboardPlatformConnection>("/api/platforms/connect", accessToken, {
    method: "POST",
    body: JSON.stringify({
      platform: input.platform,
      accessToken: input.accessToken,
      username: input.username,
      refreshToken: input.refreshToken,
      userId: input.userId,
      expiresAt: input.expiresAt,
    }),
  });
}

export async function startPlatformOAuth(
  accessToken: string,
  platform: string
): Promise<string> {
  const response = await fetchAuthedJson<{ url: string }>(
    `/api/platforms/oauth/${platform}/start`,
    accessToken,
    {
      method: "POST",
    }
  );

  return response.url;
}

export async function disconnectPlatform(
  accessToken: string,
  platform: string
): Promise<void> {
  await fetchAuthedJson<{ disconnected: boolean }>(`/api/platforms/${platform}`, accessToken, {
    method: "DELETE",
  });
}

export function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);
}

export function getDealsStageCounts(deals: DashboardDeal[]) {
  return DEAL_STAGE_ORDER.reduce<Record<string, number>>((accumulator, stage) => {
    accumulator[stage] = deals.filter((deal) => deal.stage === stage).length;
    return accumulator;
  }, {});
}

export function getWalletHeadline(transactions: DashboardTransaction[]) {
  if (transactions.length === 0) {
    return {
      count: "0",
      detail: "No paid actions yet. Agent spend will start showing up here once research tools are used.",
    };
  }

  const paidServices = new Set(
    transactions.map((transaction) => transaction.service).filter(Boolean)
  );

  return {
    count: String(transactions.length),
    detail: `${paidServices.size || 1} paid service${
      paidServices.size === 1 ? "" : "s"
    } represented in the ledger so far.`,
  };
}
