import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../dashboard/src/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../../dashboard/src/lib/api")>(
    "../../../dashboard/src/lib/api"
  );

  return {
    ...actual,
    fetchAuthProfile: vi.fn(),
    fetchDeals: vi.fn(),
    fetchTransactions: vi.fn(),
    fetchAgentState: vi.fn(),
    fetchConnections: vi.fn(),
  };
});

import {
  fetchAuthProfile,
  fetchAgentState,
  fetchConnections,
  fetchDeals,
  fetchTransactions,
} from "../../../dashboard/src/lib/api";
import {
  EMPTY_HOME_DATA,
  buildDashboardHomeModel,
  fetchDashboardHome,
  getAgentConsoleHomeState,
} from "../../../dashboard/src/lib/dashboard-home";

describe("dashboard home state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summarizes approvals, follow-ups, and wallet readiness for the Today hero", async () => {
    vi.mocked(fetchAuthProfile).mockResolvedValue({
      creator: {
        id: "creator-1",
        display_name: "Bolaji",
        niche: "creator economy",
        wallet_id: "wallet-1",
        wallet_address: "0x123",
        privy_user_id: "did:privy:user-1",
        telegram_chat_id: null,
        whatsapp_phone: null,
        settings: null,
      },
      onboarding: {
        status: "active",
        walletProvisioned: true,
        walletProvisioningInProgress: false,
        walletProvisioningAttempts: 1,
        walletProvisioningLastError: null,
      },
    });
    vi.mocked(fetchDeals).mockResolvedValue([
      {
        id: "deal-1",
        brand_name: "Acme",
        stage: "pitched",
        fit_score: 92,
        estimated_value_cents: 250000,
        notes: "Pitch sent and waiting for a reply.",
      },
      {
        id: "deal-2",
        brand_name: "Orbit",
        stage: "responded",
        fit_score: 86,
        estimated_value_cents: 180000,
        notes: null,
      },
      {
        id: "deal-3",
        brand_name: "Nimbus",
        stage: "active",
        fit_score: 78,
        estimated_value_cents: 300000,
        notes: "Campaign is already running.",
      },
    ]);
    vi.mocked(fetchTransactions).mockResolvedValue([
      {
        id: "tx-1",
        type: "agent_spend",
        amount_cents: 4200,
        currency: "USD",
        description: "Research brief",
        service: "exa_search",
        created_at: "2026-03-21T09:00:00.000Z",
      },
    ]);
    vi.mocked(fetchAgentState).mockResolvedValue({
      messages: [
        {
          id: "msg-1",
          creator_id: "creator-1",
          role: "assistant",
          content: "I found two brands worth following up.",
          metadata: { platform: "dashboard" },
          created_at: "2026-03-21T08:30:00.000Z",
        },
      ],
      pendingApprovals: [
        {
          id: "approval-1",
          creatorId: "creator-1",
          actionId: "approval-1",
          type: "email_sender",
          description: "Send the pitch email",
          preview: "A short outreach note is ready to send.",
          input: { to: "brand@example.com" },
        },
      ],
    });
    vi.mocked(fetchConnections).mockResolvedValue([
      {
        platform: "instagram",
        platform_username: "bolaji",
        connected: true,
      },
    ]);

    const data = await fetchDashboardHome("access-token");
    const model = buildDashboardHomeModel(data);

    expect(fetchAuthProfile).toHaveBeenCalledWith("access-token");
    expect(fetchDeals).toHaveBeenCalledWith("access-token");
    expect(fetchTransactions).toHaveBeenCalledWith("access-token");
    expect(fetchAgentState).toHaveBeenCalledWith("access-token");
    expect(fetchConnections).toHaveBeenCalledWith("access-token");
    expect(model.todayHero.summary).toBe(
      "1 approval, 2 follow-ups, and the wallet is ready."
    );
    expect(model.todayHero.approvalsCount).toBe(1);
    expect(model.todayHero.followUpsCount).toBe(2);
    expect(model.todayHero.walletReady).toBe(true);
    expect(model.emptyState.title).toBe("Nothing to surface yet.");
  });

  it("keeps the empty state calm when there is no creator activity yet", () => {
    const model = buildDashboardHomeModel(EMPTY_HOME_DATA);

    expect(model.hasActivity).toBe(false);
    expect(model.todayHero.summary).toBe(
      "No creator activity yet. Approvals, follow-ups, and wallet events will show up here once the first signals land."
    );
    expect(model.emptyState.title).toBe("Nothing to surface yet.");
    expect(model.emptyState.detail).toBe(
      "The desk stays quiet until a creator starts a conversation, sends a pitch, or uses the wallet."
    );
  });

  it("keeps the console unmounted while the combined home query is still loading", () => {
    expect(
      getAgentConsoleHomeState({
        isLoading: true,
        error: null,
        agentState: EMPTY_HOME_DATA.agentState,
      })
    ).toEqual({
      showLoadingShell: true,
      initialState: undefined,
      isHydrated: false,
    });
  });

  it("hydrates the console from home-query data after a successful load", () => {
    expect(
      getAgentConsoleHomeState({
        isLoading: false,
        error: null,
        agentState: EMPTY_HOME_DATA.agentState,
      })
    ).toEqual({
      showLoadingShell: false,
      initialState: EMPTY_HOME_DATA.agentState,
      isHydrated: true,
    });
  });

  it("lets the console self-fetch when the combined home query fails", () => {
    expect(
      getAgentConsoleHomeState({
        isLoading: false,
        error: "Request failed",
        agentState: EMPTY_HOME_DATA.agentState,
      })
    ).toEqual({
      showLoadingShell: false,
      initialState: undefined,
      isHydrated: false,
    });
  });
});
