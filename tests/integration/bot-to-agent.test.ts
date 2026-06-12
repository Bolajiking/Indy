import { beforeEach, describe, expect, it, vi } from "vitest";

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
}));

vi.mock("../../src/wallet/provisioning.js", () => ({
  ensureCreatorWalletProvisioning: vi.fn(),
}));

vi.mock("../../src/db/queries/messages.js", () => ({
  saveMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../src/bot/whatsapp.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/bot/whatsapp.js")>();

  return {
    ...actual,
    sendWhatsAppMessage: vi.fn(),
    verifyWhatsAppSignature: vi.fn().mockReturnValue(true),
  };
});

import { processCreatorMessage } from "../../src/agent/conversation.js";
import { createApiServer } from "../../src/api/server.js";
import { webhooks } from "../../src/api/routes/webhooks.js";
import {
  createCreator,
  findCreatorByWhatsApp,
} from "../../src/db/queries/creators.js";
import { ensureCreatorWalletProvisioning } from "../../src/wallet/provisioning.js";
import { sendWhatsAppMessage } from "../../src/bot/whatsapp.js";

describe("bot-to-agent integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(processCreatorMessage).mockResolvedValue({
      text: "Here's what I found.",
      requiresApproval: false,
    });
  });

  it("onboards a new WhatsApp creator through the webhook route", async () => {
    vi.mocked(findCreatorByWhatsApp).mockResolvedValue(null);
    vi.mocked(createCreator).mockResolvedValue({
      id: "creator-1",
      telegram_chat_id: null,
      whatsapp_phone: "2348000",
      display_name: "Ada",
      niche: null,
      wallet_id: null,
      wallet_address: null,
      free_credits_remaining_cents: 1000,
      monthly_spend_cents: 0,
      settings: { bot_onboarding_step: 1 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);
    vi.mocked(ensureCreatorWalletProvisioning).mockResolvedValue({
      started: true,
      creator: null,
      reason: "started",
    } as never);

    const app = createApiServer();
    app.route("/webhooks", webhooks);

    const response = await app.request("/webhooks/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  contacts: [{ profile: { name: "Ada" } }],
                  messages: [
                    {
                      from: "2348000",
                      type: "text",
                      text: { body: "hello" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(createCreator).toHaveBeenCalledWith({
      display_name: "Ada",
      telegram_chat_id: undefined,
      whatsapp_phone: "2348000",
      settings: { bot_onboarding_step: 1 },
    });
    expect(ensureCreatorWalletProvisioning).toHaveBeenCalledWith("creator-1", {
      force: true,
      source: "messaging_onboarding",
    });
    expect(sendWhatsAppMessage).toHaveBeenCalledWith(
      "2348000",
      expect.objectContaining({
        parseMode: "Markdown",
        text: expect.stringContaining("your AI business manager"),
      }),
    );
  });

  it("routes an existing creator message into the agent and sends the reply", async () => {
    vi.mocked(findCreatorByWhatsApp).mockResolvedValue({
      id: "creator-2",
      telegram_chat_id: null,
      whatsapp_phone: "2348001",
      display_name: "Bola",
      niche: "finance",
      wallet_id: "wallet-2",
      wallet_address: "0x456",
      free_credits_remaining_cents: 1000,
      monthly_spend_cents: 0,
      settings: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never);
    vi.mocked(processCreatorMessage).mockResolvedValue({
      text: "I found three strong sponsor targets for you.",
      requiresApproval: false,
    });

    const app = createApiServer();
    app.route("/webhooks", webhooks);

    const response = await app.request("/webhooks/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                field: "messages",
                value: {
                  contacts: [{ profile: { name: "Bola" } }],
                  messages: [
                    {
                      from: "2348001",
                      type: "text",
                      text: { body: "scan for deals" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(processCreatorMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        creatorId: "creator-2",
        text: "scan for deals",
      }),
    );
    expect(sendWhatsAppMessage).toHaveBeenCalledWith("2348001", {
      text: "I found three strong sponsor targets for you.",
      parseMode: "Markdown",
    });
  });
});
