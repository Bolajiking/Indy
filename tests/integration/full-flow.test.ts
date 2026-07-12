import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovalAction } from "../../src/bot/approval.js";

vi.mock("../../src/agent/orchestrator.js", () => ({
  runAgent: vi.fn(),
}));

vi.mock("../../src/agent/conversation.js", () => ({
  processCreatorMessage: vi.fn(),
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

vi.mock("../../src/bot/approval.js", () => {
  const store = new Map<string, ApprovalAction[]>();
  return {
    storePendingApproval: vi.fn(
      async (
        action: Omit<ApprovalAction, "id"> & { id?: string },
      ): Promise<ApprovalAction> => {
        const key = action.creatorId;
        const saved = {
          ...action,
          id: action.id ?? action.actionId,
        };
        if (!store.has(key)) store.set(key, []);
        store.get(key)!.push(saved);
        return saved;
      },
    ),
    getPendingApprovalsForCreator: vi.fn(
      (creatorId: string) => store.get(creatorId) ?? [],
    ),
    getPendingApprovalByAction: vi.fn(),
    claimPendingApproval: vi.fn(),
    markApprovalSkipped: vi.fn(),
  };
});

vi.mock("../../src/bot/formatters.js", () => ({}));

import { runAgent } from "../../src/agent/orchestrator.js";
import { processCreatorMessage } from "../../src/agent/conversation.js";
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
    vi.mocked(processCreatorMessage).mockResolvedValue({
      text: "Here's what I found.",
      requiresApproval: false,
    });
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
    expect(ensureCreatorWalletProvisioning).toHaveBeenCalledWith(
      "new-creator",
      {
        force: true,
        source: "messaging_onboarding",
      },
    );
    expect(res.text).toContain("your AI business manager");
    expect(res.text).toContain("wallet");
    expect(res.parseMode).toBe("Markdown");
  });

  it("existing creator sends free-text → agent responds", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);
    vi.mocked(processCreatorMessage).mockResolvedValue({
      text: "Found 2 brand opportunities for you.",
      requiresApproval: false,
    });

    const res = await handleMessage({
      platform: "telegram",
      platformUserId: "tg-100",
      displayName: "FlowUser",
      text: "scan for deals",
    });

    expect(processCreatorMessage).toHaveBeenCalled();
    expect(res.text).toBe("Found 2 brand opportunities for you.");
  });

  it("agent requests approval → buttons returned → approval stored", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);
    vi.mocked(processCreatorMessage).mockResolvedValue({
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
  });

  it("'calendar' command routes to AgentOS with calendar intent", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);
    vi.mocked(processCreatorMessage).mockResolvedValue({
      text: "*Upcoming Deadlines*\n\nBrand pitch due (2026-03-25)",
      requiresApproval: false,
    });

    const res = await handleMessage({
      platform: "telegram",
      platformUserId: "tg-100",
      displayName: "FlowUser",
      text: "calendar",
    });

    expect(processCreatorMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "show my upcoming deadlines and calendar",
      }),
    );
    expect(res.text).toContain("Upcoming Deadlines");
  });

  it("'finances' command routes to AgentOS with financial intent", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);
    vi.mocked(processCreatorMessage).mockResolvedValue({
      text: "*Financial Snapshot*\nNet: $0",
      requiresApproval: false,
    });

    const res = await handleMessage({
      platform: "telegram",
      platformUserId: "tg-100",
      displayName: "FlowUser",
      text: "finances",
    });

    expect(processCreatorMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "give me my financial snapshot" }),
    );
    expect(res.text).toContain("Financial Snapshot");
  });

  it("'content plan' command routes to AgentOS with content intent", async () => {
    vi.mocked(findCreatorByTelegram).mockResolvedValue(mockCreator);
    vi.mocked(processCreatorMessage).mockResolvedValue({
      text: "*Content Strategy*\nNo posts",
      requiresApproval: false,
    });

    const res = await handleMessage({
      platform: "telegram",
      platformUserId: "tg-100",
      displayName: "FlowUser",
      text: "content plan",
    });

    expect(processCreatorMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: "generate my content strategy" }),
    );
    expect(res.text).toContain("Content Strategy");
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
