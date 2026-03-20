import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/agent/orchestrator.js", () => ({
  runAgent: vi.fn(),
}));

vi.mock("../../../src/db/queries/creators.js", () => ({
  findCreatorByTelegram: vi.fn(),
  findCreatorByWhatsApp: vi.fn(),
  createCreator: vi.fn(),
}));

vi.mock("../../../src/wallet/provisioning.js", () => ({
  ensureCreatorWalletProvisioning: vi.fn(),
}));

vi.mock("../../../src/db/queries/messages.js", () => ({
  saveMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../../src/bot/approval.js", () => ({
  storePendingApproval: vi.fn().mockResolvedValue({
    id: "toolu_123",
    creatorId: "creator-3",
    type: "generate_pitch",
    description: "Send a pitch to Acme",
    preview: "Send a pitch to Acme",
    input: { brand: "Acme" },
  }),
  getPendingApprovalsForCreator: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../src/db/queries/deals.js", () => ({
  getDealsForCreator: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../src/db/queries/transactions.js", () => ({
  getTransactionsForCreator: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../src/db/queries/platform-connections.js", () => ({
  getConnectionsForCreator: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../src/agent/skills/calendar-manager.js", () => ({
  getCalendarView: vi.fn().mockResolvedValue({
    overdue: [],
    upcoming: [{ title: "Acme draft due", date: "2026-03-25" }],
    today: [],
  }),
}));

vi.mock("../../../src/agent/skills/financial-tracker.js", () => ({
  generateFinancialSnapshot: vi.fn().mockResolvedValue({
    creatorId: "creator-cmd",
    period: "March 2026",
    income: { totalCents: 50000, bySource: {} },
    expenses: { totalCents: 1000, byCategory: {} },
    netCents: 49000,
    deals: { active: 1, pipeline: 2, completed: 0 },
    forecast: { nextMonthCents: 50000, confidence: 0.5 },
  }),
}));

vi.mock("../../../src/agent/skills/content-strategy.js", () => ({
  generateContentStrategy: vi.fn().mockResolvedValue({
    creatorId: "creator-cmd",
    weekOf: "2026-03-16",
    posts: [],
    themes: [],
    tips: [],
  }),
}));

vi.mock("../../../src/bot/formatters.js", () => ({
  formatFinancialSnapshot: vi.fn().mockReturnValue("*Financial Snapshot*\nNet: $490"),
  formatContentStrategy: vi.fn().mockReturnValue("*Content Strategy*\nNo posts planned"),
}));

import { runAgent } from "../../../src/agent/orchestrator.js";
import {
  createCreator,
  findCreatorByTelegram,
  findCreatorByWhatsApp,
} from "../../../src/db/queries/creators.js";
import { ensureCreatorWalletProvisioning } from "../../../src/wallet/provisioning.js";
import { getPendingApprovalsForCreator, storePendingApproval } from "../../../src/bot/approval.js";
import { handleMessage, type IncomingMessage } from "../../../src/bot/handler.js";

describe("handleMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runAgent).mockReset();
  });

  it("onboards a new Telegram creator and starts wallet provisioning", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(null);
    vi.mocked(createCreator).mockResolvedValue({
      id: "creator-1",
      telegram_chat_id: "123",
      whatsapp_phone: null,
      display_name: "Ada",
      niche: null,
      wallet_id: null,
      wallet_address: null,
      free_credits_remaining_cents: 1000,
      monthly_spend_cents: 0,
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);
    vi.mocked(ensureCreatorWalletProvisioning).mockResolvedValue({
      started: true,
      creator: null,
      reason: "started",
    } as never);

    const response = await handleMessage({
      platform: "telegram",
      platformUserId: "123",
      displayName: "Ada",
      text: "hello",
    });

    expect(createCreator).toHaveBeenCalledWith({
      display_name: "Ada",
      telegram_chat_id: "123",
      whatsapp_phone: undefined,
    });
    expect(ensureCreatorWalletProvisioning).toHaveBeenCalledWith("creator-1", {
      force: true,
      source: "messaging_onboarding",
    });
    expect(response.parseMode).toBe("Markdown");
    expect(response.text).toContain("your AI business manager");
    expect(response.text).toContain("setting up your wallet");
  });

  it("returns the welcome command list for an existing creator greeting", async () => {
    vi.mocked(findCreatorByWhatsApp).mockResolvedValue({
      id: "creator-2",
      telegram_chat_id: null,
      whatsapp_phone: "2348000",
      display_name: "Bola",
      niche: "fitness",
      wallet_id: "wallet-2",
      wallet_address: "0x456",
      free_credits_remaining_cents: 1000,
      monthly_spend_cents: 0,
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);

    const response = await handleMessage({
      platform: "whatsapp",
      platformUserId: "2348000",
      displayName: "Bola",
      text: "hi",
    });

    expect(response.text).toContain("Welcome back, Bola");
    expect(response.text).toContain("/scan");
    expect(response.text).toContain("Quick Commands");
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("stores approval state when the agent asks for approval", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue({
      id: "creator-3",
      telegram_chat_id: "999",
      whatsapp_phone: null,
      display_name: "Chris",
      niche: "tech",
      wallet_id: "wallet-3",
      wallet_address: "0x789",
      free_credits_remaining_cents: 1000,
      monthly_spend_cents: 0,
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);
    vi.mocked(runAgent).mockResolvedValue({
      text: "I drafted a pitch for Acme.",
      requiresApproval: true,
      pendingAction: {
        id: "toolu_123",
        type: "generate_pitch",
        description: "Send a pitch to Acme",
        input: { brand: "Acme" },
      },
    });

    const response = await handleMessage({
      platform: "telegram",
      platformUserId: "999",
      displayName: "Chris",
      text: "pitch Acme",
    });

    expect(response.buttons).toEqual([
      { text: "✅ Send", callbackData: "approve:creator-3:toolu_123" },
      { text: "❌ Skip", callbackData: "skip:creator-3:toolu_123" },
    ]);
    expect(response.text).toContain("I drafted a pitch for Acme.");
    expect(storePendingApproval).toHaveBeenCalledWith({
      id: "toolu_123",
      creatorId: "creator-3",
      actionId: "toolu_123",
      type: "generate_pitch",
      description: "Send a pitch to Acme",
      preview: "I drafted a pitch for Acme.",
      input: { brand: "Acme" },
    });
  });
});

describe("IncomingMessage type", () => {
  it("captures required bot input fields", () => {
    const msg: IncomingMessage = {
      platform: "telegram",
      platformUserId: "12345",
      displayName: "Test User",
      text: "hello",
    };

    expect(msg.platform).toBe("telegram");
  });
});

const mockExistingCreator = {
  id: "creator-cmd",
  telegram_chat_id: "500",
  whatsapp_phone: null,
  display_name: "CmdUser",
  niche: "tech",
  wallet_id: "wallet-cmd",
  wallet_address: "0xabc",
  free_credits_remaining_cents: 1000,
  monthly_spend_cents: 0,
  settings: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("quick-command routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(runAgent).mockReset();
  });

  it("handles 'calendar' command and returns deadlines", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockExistingCreator as never);

    const response = await handleMessage({
      platform: "telegram",
      platformUserId: "500",
      displayName: "CmdUser",
      text: "calendar",
    });

    expect(response.text).toContain("Upcoming Deadlines");
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("handles 'finances' command and returns financial snapshot", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockExistingCreator as never);

    const response = await handleMessage({
      platform: "telegram",
      platformUserId: "500",
      displayName: "CmdUser",
      text: "finances",
    });

    expect(response.text).toContain("Financial Snapshot");
    expect(runAgent).not.toHaveBeenCalled();
  });

  it("handles 'deadlines' alias for calendar", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockExistingCreator as never);

    const response = await handleMessage({
      platform: "telegram",
      platformUserId: "500",
      displayName: "CmdUser",
      text: "deadlines",
    });

    expect(response.text).toContain("Upcoming Deadlines");
  });

  it("handles 'money' alias for finances", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockExistingCreator as never);

    const response = await handleMessage({
      platform: "telegram",
      platformUserId: "500",
      displayName: "CmdUser",
      text: "money",
    });

    expect(response.text).toContain("Financial Snapshot");
  });
});

describe("onboarding error handling", () => {
  it("gracefully handles wallet provisioning failure", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(null);
    vi.mocked(createCreator).mockResolvedValue({
      ...mockExistingCreator,
      id: "creator-fail",
      wallet_id: null,
      wallet_address: null,
    } as never);
    vi.mocked(ensureCreatorWalletProvisioning).mockResolvedValue({
      started: false,
      creator: null,
      reason: "already_in_progress",
    } as never);

    const response = await handleMessage({
      platform: "telegram",
      platformUserId: "600",
      displayName: "NewUser",
      text: "hi",
    });

    expect(response.text).toContain("your AI business manager");
    expect(response.text).toContain("setting up your wallet");
    expect(ensureCreatorWalletProvisioning).toHaveBeenCalled();
  });
});
