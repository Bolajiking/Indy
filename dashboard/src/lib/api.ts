import type {
  ApiAggregatedAnalytics,
  ApiAgentApprovalResponse,
  ApiAgentMessageResponse,
  ApiAgentState,
  ApiAuthProfileResponse,
  ApiConnectionDisconnectResponse,
  ApiConnectionInitiateResponse,
  ApiConnectionsInfo,
  ApiCreatorProfile,
  ApiDeal,
  ApiDealStage,
  ApiFinancialSnapshot,
  ApiMessagingLink,
  ApiMessagingPlatform,
  ApiOnboardingContextInput,
  ApiOnboardingState,
  ApiPaymentAttempt,
  ApiPendingApproval,
  ApiProfileUpdateInput,
  ApiRegistrationInput,
  ApiTransaction,
  ApiWalletBalance,
} from "../../../src/api/contracts.js";

export type DashboardDeal = ApiDeal;
export type DashboardDealStage = ApiDealStage;
export type DashboardTransaction = ApiTransaction;
export type DashboardPaymentAttempt = ApiPaymentAttempt;
export type DashboardCreator = ApiCreatorProfile;
export type DashboardOnboardingState = ApiOnboardingState;
export type OnboardingContextInput = ApiOnboardingContextInput;
export type DashboardAuthResponse = ApiAuthProfileResponse;
export type DashboardRegistrationInput = ApiRegistrationInput;
export type DashboardProfileUpdateInput = ApiProfileUpdateInput;
export type DashboardMessagingLink = ApiMessagingLink;
export type DashboardPendingApproval = ApiPendingApproval;
export type DashboardAgentState = ApiAgentState;
export type DashboardAgentMessageResponse = ApiAgentMessageResponse;
export type DashboardAgentApprovalResponse = ApiAgentApprovalResponse;
export type DashboardWalletBalance = ApiWalletBalance;
export type DashboardMessagingPlatform = ApiMessagingPlatform;
export type DashboardConnectionsInfo = ApiConnectionsInfo;
export type FinancialSnapshot = ApiFinancialSnapshot;
export type AggregatedAnalytics = ApiAggregatedAnalytics;

const PROXY_BASE = "/api/proxy";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toProxyPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${PROXY_BASE}${normalized}`;
}

async function parseProxyResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const body: unknown = await response.json();
      if (isRecord(body) && typeof body.error === "string") {
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
  init?: RequestInit,
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

export async function fetchAuthProfile(
  accessToken: string,
): Promise<DashboardAuthResponse> {
  return fetchAuthedJson<DashboardAuthResponse>("/api/auth/me", accessToken);
}

export async function registerCreatorProfile(
  accessToken: string,
  input: DashboardRegistrationInput,
): Promise<DashboardAuthResponse> {
  return fetchAuthedJson<DashboardAuthResponse>(
    "/api/auth/register",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function updateCreatorProfile(
  accessToken: string,
  input: DashboardProfileUpdateInput,
): Promise<DashboardAuthResponse> {
  return fetchAuthedJson<DashboardAuthResponse>("/api/auth/me", accessToken, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function retryCreatorWalletProvisioning(
  accessToken: string,
): Promise<DashboardAuthResponse> {
  return fetchAuthedJson<DashboardAuthResponse>(
    "/api/auth/me/wallet/retry",
    accessToken,
    {
      method: "POST",
    },
  );
}

export async function saveOnboardingContext(
  accessToken: string,
  input: OnboardingContextInput,
): Promise<DashboardAuthResponse> {
  return fetchAuthedJson<DashboardAuthResponse>(
    "/api/auth/onboarding",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function fetchDeals(
  accessToken: string,
): Promise<DashboardDeal[]> {
  return fetchAuthedJson<DashboardDeal[]>("/api/deals", accessToken);
}

export async function patchDealStage(
  accessToken: string,
  dealId: string,
  stage: DashboardDealStage,
): Promise<DashboardDeal> {
  return fetchAuthedJson<DashboardDeal>(
    `/api/deals/${dealId}/stage`,
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    },
  );
}

export async function fetchTransactions(
  accessToken: string,
): Promise<DashboardTransaction[]> {
  return fetchAuthedJson<DashboardTransaction[]>(
    "/api/wallet/transactions?limit=20",
    accessToken,
  );
}

export async function fetchPaymentAttempts(
  accessToken: string,
): Promise<DashboardPaymentAttempt[]> {
  return fetchAuthedJson<DashboardPaymentAttempt[]>(
    "/api/wallet/payment-attempts?limit=20",
    accessToken,
  );
}

export async function fetchWalletBalance(
  accessToken: string,
): Promise<DashboardWalletBalance> {
  return fetchAuthedJson<DashboardWalletBalance>(
    "/api/wallet/balance",
    accessToken,
  );
}

export async function fetchAgentState(
  accessToken: string,
): Promise<DashboardAgentState> {
  return fetchAuthedJson<DashboardAgentState>("/api/agent/state", accessToken);
}

export async function sendAgentMessage(
  accessToken: string,
  text: string,
): Promise<DashboardAgentMessageResponse> {
  return fetchAuthedJson<DashboardAgentMessageResponse>(
    "/api/agent/messages",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({ text }),
    },
  );
}

export async function approveAgentAction(
  accessToken: string,
  actionId: string,
): Promise<DashboardAgentApprovalResponse> {
  return fetchAuthedJson<DashboardAgentApprovalResponse>(
    `/api/agent/approvals/${actionId}/approve`,
    accessToken,
    { method: "POST" },
  );
}

export async function skipAgentAction(
  accessToken: string,
  actionId: string,
): Promise<DashboardAgentApprovalResponse> {
  return fetchAuthedJson<DashboardAgentApprovalResponse>(
    `/api/agent/approvals/${actionId}/skip`,
    accessToken,
    { method: "POST" },
  );
}

export async function createMessagingLink(
  accessToken: string,
  platform: DashboardMessagingPlatform,
): Promise<DashboardMessagingLink> {
  return fetchAuthedJson<DashboardMessagingLink>(
    `/api/messaging-links/${platform}`,
    accessToken,
    { method: "POST" },
  );
}

export async function fetchFinancial(
  accessToken: string,
): Promise<FinancialSnapshot | null> {
  return fetchAuthedJson<FinancialSnapshot | null>(
    "/api/reports/financial",
    accessToken,
  );
}

export async function fetchAnalytics(
  accessToken: string,
): Promise<AggregatedAnalytics | null> {
  return fetchAuthedJson<AggregatedAnalytics | null>(
    "/api/reports/analytics",
    accessToken,
  );
}

export async function startPlatformOAuth(
  accessToken: string,
  platform: string,
): Promise<string> {
  const response = await fetchAuthedJson<{ url: string }>(
    `/api/platforms/oauth/${platform}/start`,
    accessToken,
    {
      method: "POST",
    },
  );

  return response.url;
}

export async function fetchConnectionsInfo(
  accessToken: string,
): Promise<DashboardConnectionsInfo> {
  return fetchAuthedJson<DashboardConnectionsInfo>(
    "/api/connections",
    accessToken,
  );
}

/** Start a Composio-backed connection; returns the OAuth redirect URL.
 * `returnTo` controls where the OAuth callback lands — the chat ("chat") or
 * Settings (default) — so success is surfaced where the flow started. */
export async function initiateConnection(
  accessToken: string,
  toolkit: string,
  returnTo: "chat" | "settings" = "settings",
): Promise<string> {
  const response = await fetchAuthedJson<ApiConnectionInitiateResponse>(
    `/api/connections/${toolkit}/initiate${returnTo === "chat" ? "?return=chat" : ""}`,
    accessToken,
    { method: "POST" },
  );

  return response.redirectUrl;
}

/** Disconnect a Composio-backed connection; returns how many accounts were removed. */
export async function disconnectConnection(
  accessToken: string,
  toolkit: string,
): Promise<number> {
  const response = await fetchAuthedJson<ApiConnectionDisconnectResponse>(
    `/api/connections/${toolkit}`,
    accessToken,
    { method: "DELETE" },
  );

  return response.disconnected;
}

export function formatCurrency(amountCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
  }).format(amountCents / 100);
}
