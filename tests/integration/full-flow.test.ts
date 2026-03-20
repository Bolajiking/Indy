import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/agent/orchestrator.js", () => ({
  runAgent: vi.fn(),
}));

vi.mock("../../src/db/queries/creators.js", () => ({
  findCreatorByTelegram: vi.fn(),
  findCreatorByWhatsApp: vi.fn(),
  createCreator: vi.fn(),
  getCreatorById: vi.fn(),
}));

vi.mock("../../src/wallet/provisioning.js", () => ({
  ensureCreatorWalletProvisioning: vi.fn(),
}));

vi.mock("../../src/db/queries/messages.js", () => ({
  saveMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../src/db/queries/deals.js", () => ({
  getDealsForCreator: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/db/queries/transactions.js", () => ({
  getTransactionsForCreator: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/db/queries/platform-connections.js", () => ({
  getConnectionsForCreator: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../src/agent/skills/calendar-manager.js", () => ({
  getCalendarView: vi.fn().mockResolvedValue({
    overdue: [],
    upcoming: [{ title: "Brand pitch due", date: "2026-03-25" }],
    today: [],
  }),
}));

vi.mock("../../src/agent/skills/financial-tracker.js", () => ({
  generateFinancialSnapshot: vi.fn().mockResolvedValue({
    creatorId: "c",
    period: "March 2026",
    income: { totalCents: 0, bySource: {} },
    expenses: { totalCents: 0, byCategory: {} },
    netCents: 0,
    deals: { active: 0, pipeline: 0, completed: 0 },
    forecast: { nextMonthCents: 0, confidence: 0 },
  }),
}));

vi.mock("../../src/agent/skills/content-strategy.js", () => ({
  generateContentStrategy: vi.fn().mockResolvedValue({
    creatorId: "c",
    weekOf: "2026-03-16",
    posts: [],
    themes: [],
    tips: [],
  }),
}));

vi.mock("../../src/bot/approval.js", () => {
  const store = new Map<string, any[]>();
  return {
    storePendingApproval: vi.fn((action: any) => {
      const key = action.creatorId;
      if (!store.has(key)) store.set(key, []);
      store.get(key)!.push(action);
      return `${action.creatorId}:${action.actionId}`;
    }),
    getPendingApprovalsForCreator: vi.fn((creatorId: string) => store.get(creatorId) ?? []),
    getPendingApprovalByAction: vi.fn(),
    markApprovalApproved: vi.fn(),
    markApprovalSkipped: vi.fn(),
  };
});

vi.mock("../../src/bot/formatters.js", () => ({
  formatFinancialSnapshot: vi.fn().mockReturnValue("*Financial Snapshot*\nNet: $0"),
  formatContentStrategy: vi.fn().mockReturnValue("*Content Strategy*\nNo posts"),
}));

import { runAgent } from "../../src/agent/orchestrator.js";
import {
  findCreatorByTelegram,
  createCreator,
} from "../../src/db/queries/creators.js";
import { ensureCreatorWalletProvisioning } from "../../src/wallet/provisioning.js";
import { handleMessage } from "../../src/bot/handler.js";
import { getPendingApprovalsForCreator } from "../../src/bot/approval.js";

const mockCreator = {
  id: "creator-flow",
  telegram_chat_id: "tg-100",
  whatsapp_phone: null,
  display_name: "FlowUser",
  niche: "tech",
  wallet_id: "wallet-flow",
  wallet_address: "0xflow",
  free_credits_remaining_cents: 1000,
  monthly_spend_cents: 0,
  settings: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as never;

describe("full end-to-end flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runAgent).mockReset();
  });

  it("onboards new creator → wallet → welcome message", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(null);
    vi.mocked(createCreator).mockResolvedValue({
      ...mockCreator,
      id: "new-creator",
      wallet_id: null,
      wallet_address: null,
    } as never);
    vi.mocked(ensureCreatorWalletProvisioning).mockResolvedValue({
      started: true,
      creator: null,
      reason: "started",
    } as never);

    const res = await handleMessage({
      platform: "telegram",
      platformUserId: "tg-100",
      displayName: "FlowUser",
      text: "hi",
    });

    expect(createCreator).toHaveBeenCalled();
    expect(ensureCreatorWalletProvisioning).toHaveBeenCalledWith("new-creator", {
      force: true,
      source: "messaging_onboarding",
    });
    expect(res.text).toContain("your AI business manager");
    expect(res.text).toContain("setting up your wallet");
    expect(res.parseMode).toBe("Markdown");
  });

  it("existing creator sends free-text → agent responds", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);
    vi.mocked(runAgent).mockResolvedValue({
      text: "Found 2 brand opportunities for you.",
      requiresApproval: false,
    });

    const res = await handleMessage({
      platform: "telegram",
      platformUserId: "tg-100",
      displayName: "FlowUser",
      text: "scan for deals",
    });

    expect(runAgent).toHaveBeenCalledWith("creator-flow", "scan for deals", "wallet-flow", "0xflow");
    expect(res.text).toBe("Found 2 brand opportunities for you.");
  });

  it("agent requests approval → buttons returned → approval stored", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);
    vi.mocked(runAgent).mockResolvedValue({
      text: "I want to send a pitch email to Acme.",
      requiresApproval: true,
      pendingAction: {
        id: "action-xyz",
        type: "send_email",
        description: "Pitch to Acme Corp",
        input: { brand: "Acme" },
      },
    });

    const res = await handleMessage({
      platform: "telegram",
      platformUserId: "tg-100",
      displayName: "FlowUser",
      text: "pitch acme",
    });

    expect(res.buttons).toBeDefined();
    expect(res.buttons).toHaveLength(2);
    expect(res.buttons![0].text).toBe("✅ Send");
    expect(res.buttons![0].callbackData).toContain("approve:creator-flow:");
    expect(getPendingApprovalsForCreator("creator-flow")).toHaveLength(1);
  });

  it("quick-command 'calendar' bypasses agent", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);

    const res = await handleMessage({
      platform: "telegram",
      platformUserId: "tg-100",
      displayName: "FlowUser",
      text: "calendar",
    });

    expect(res.text).toContain("Upcoming Deadlines");
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("quick-command 'finances' bypasses agent", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);

    const res = await handleMessage({
      platform: "telegram",
      platformUserId: "tg-100",
      displayName: "FlowUser",
      text: "finances",
    });

    expect(res.text).toContain("Financial Snapshot");
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("quick-command 'content plan' bypasses agent", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);

    const res = await handleMessage({
      platform: "telegram",
      platformUserId: "tg-100",
      displayName: "FlowUser",
      text: "content plan",
    });

    expect(res.text).toContain("Content Strategy");
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("greeting returns welcome menu without agent", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);

    const res = await handleMessage({
      platform: "telegram",
      platformUserId: "tg-100",
      displayName: "FlowUser",
      text: "hello",
    });

    expect(res.text).toContain("Welcome back");
    expect(res.text).toContain("/scan");
    expect(res.text).toContain("Quick Commands");
    expect(runAgent).not.toHaveBeenCalled();
  });
});
