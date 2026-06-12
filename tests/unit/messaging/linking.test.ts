import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/queries/creators.js", () => ({
  findCreatorByTelegram: vi.fn(),
  findCreatorByWhatsApp: vi.fn(),
  getCreatorById: vi.fn(),
  updateCreator: vi.fn(),
}));

vi.mock("../../../src/db/queries/messaging-link-sessions.js", () => ({
  consumeMessagingLinkSession: vi.fn(),
}));

import {
  findCreatorByTelegram,
  findCreatorByWhatsApp,
  getCreatorById,
  updateCreator,
} from "../../../src/db/queries/creators.js";
import { consumeMessagingLinkSession } from "../../../src/db/queries/messaging-link-sessions.js";
import { connectMessagingChannelFromToken } from "../../../src/messaging/linking.js";
import { createMessagingLinkToken } from "../../../src/messaging/link-tokens.js";

const baseCreator = {
  id: "5f4aa8d8-2fe8-4ae6-84e2-f452ca785d88",
  privy_user_id: "did:privy:user-1",
  telegram_chat_id: null,
  whatsapp_phone: null,
  display_name: "Ada",
  niche: "tech",
  wallet_id: "wallet-1",
  wallet_address: "0x123",
  free_credits_remaining_cents: 1000,
  monthly_spend_cents: 0,
  settings: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("connectMessagingChannelFromToken", () => {
  const sessionId = "5f4aa8d8-2fe8-4ae6-84e2-f452ca785d89";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links a Telegram chat to an existing creator from a valid token", async () => {
    const { token } = createMessagingLinkToken({ sessionId });
    vi.mocked(consumeMessagingLinkSession).mockResolvedValue({
      id: sessionId,
      creator_id: baseCreator.id,
      platform: "telegram",
      token_hash: "token-hash",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: new Date().toISOString(),
      consumed_by_platform_user_id: "777",
      created_at: new Date().toISOString(),
    } as never);
    vi.mocked(getCreatorById).mockResolvedValue(baseCreator as never);
    vi.mocked(findCreatorByTelegram).mockResolvedValue(null);
    vi.mocked(updateCreator).mockResolvedValue({
      ...baseCreator,
      telegram_chat_id: "777",
    } as never);

    const result = await connectMessagingChannelFromToken({
      platform: "telegram",
      token,
      platformUserId: "777",
    });

    expect(result.status).toBe("linked");
    expect(consumeMessagingLinkSession).toHaveBeenCalledWith(
      sessionId,
      "telegram",
      expect.any(String),
      "777",
    );
    expect(updateCreator).toHaveBeenCalledWith(
      baseCreator.id,
      expect.objectContaining({
        telegram_chat_id: "777",
      }),
    );
  });

  it("returns invalid_or_expired for a bad token", async () => {
    const result = await connectMessagingChannelFromToken({
      platform: "telegram",
      token: "bad-token",
      platformUserId: "777",
    });

    expect(result.status).toBe("invalid_or_expired");
  });

  it("returns channel_in_use when the messaging identity belongs to another creator", async () => {
    const { token } = createMessagingLinkToken({ sessionId });
    vi.mocked(consumeMessagingLinkSession).mockResolvedValue({
      id: sessionId,
      creator_id: baseCreator.id,
      platform: "whatsapp",
      token_hash: "token-hash",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      consumed_at: new Date().toISOString(),
      consumed_by_platform_user_id: "2348000",
      created_at: new Date().toISOString(),
    } as never);
    vi.mocked(getCreatorById).mockResolvedValue(baseCreator as never);
    vi.mocked(findCreatorByWhatsApp).mockResolvedValue({
      ...baseCreator,
      id: "other-creator",
      whatsapp_phone: "2348000",
    } as never);

    const result = await connectMessagingChannelFromToken({
      platform: "whatsapp",
      token,
      platformUserId: "2348000",
    });

    expect(result.status).toBe("channel_in_use");
    expect(updateCreator).not.toHaveBeenCalled();
  });

  it("rejects a reused code after the first successful consume", async () => {
    const { token } = createMessagingLinkToken({ sessionId });
    vi.mocked(consumeMessagingLinkSession)
      .mockResolvedValueOnce({
        id: sessionId,
        creator_id: baseCreator.id,
        platform: "telegram",
        token_hash: "token-hash",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        consumed_at: new Date().toISOString(),
        consumed_by_platform_user_id: "777",
        created_at: new Date().toISOString(),
      } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(getCreatorById).mockResolvedValue(baseCreator as never);
    vi.mocked(findCreatorByTelegram).mockResolvedValue(null);
    vi.mocked(updateCreator).mockResolvedValue({
      ...baseCreator,
      telegram_chat_id: "777",
    } as never);

    const first = await connectMessagingChannelFromToken({
      platform: "telegram",
      token,
      platformUserId: "777",
    });
    const second = await connectMessagingChannelFromToken({
      platform: "telegram",
      token,
      platformUserId: "777",
    });

    expect(first.status).toBe("linked");
    expect(second.status).toBe("invalid_or_expired");
  });
});
