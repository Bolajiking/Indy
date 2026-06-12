import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/queries/creators.js", () => ({
  findCreatorByTelegram: vi.fn(),
  getCreatorByPrivyUserId: vi.fn(),
  updateCreator: vi.fn(),
}));

vi.mock("../../../src/wallet/privy.js", () => ({
  privy: {
    utils: vi.fn(() => ({
      auth: vi.fn(() => ({
        verifyAccessToken: verifyAccessTokenMock,
      })),
    })),
    users: vi.fn(() => ({
      _get: getPrivyUserMock,
    })),
  },
}));

const { verifyAccessTokenMock, getPrivyUserMock } = vi.hoisted(() => ({
  verifyAccessTokenMock: vi.fn(),
  getPrivyUserMock: vi.fn(),
}));

import {
  findCreatorByTelegram,
  getCreatorByPrivyUserId,
  updateCreator,
} from "../../../src/db/queries/creators.js";
import {
  authenticateAccessToken,
  CREATOR_SERVICE_UNAVAILABLE_MESSAGE,
} from "../../../src/auth/session.js";

describe("authenticateAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAccessTokenMock.mockResolvedValue({
      user_id: "did:privy:user-1",
    });
  });

  it("returns the existing creator when the Privy user is already linked", async () => {
    vi.mocked(getCreatorByPrivyUserId).mockResolvedValue({
      id: "creator-1",
      privy_user_id: "did:privy:user-1",
    } as never);

    const session = await authenticateAccessToken("access-token");

    expect(session).toEqual({
      accessToken: "access-token",
      privyUserId: "did:privy:user-1",
      creatorId: "creator-1",
    });
    expect(getPrivyUserMock).not.toHaveBeenCalled();
  });

  it("claims an existing Telegram creator for the matching Privy-linked Telegram identity", async () => {
    vi.mocked(getCreatorByPrivyUserId).mockResolvedValue(null);
    getPrivyUserMock.mockResolvedValue({
      id: "did:privy:user-1",
      linked_accounts: [
        {
          type: "telegram",
          telegram_user_id: "7327569952",
        },
      ],
    });
    vi.mocked(findCreatorByTelegram).mockResolvedValue({
      id: "creator-telegram",
      privy_user_id: null,
      telegram_chat_id: "7327569952",
    } as never);
    vi.mocked(updateCreator).mockResolvedValue({
      id: "creator-telegram",
      privy_user_id: "did:privy:user-1",
      telegram_chat_id: "7327569952",
    } as never);

    const session = await authenticateAccessToken("access-token");

    expect(findCreatorByTelegram).toHaveBeenCalledWith("7327569952");
    expect(updateCreator).toHaveBeenCalledWith(
      "creator-telegram",
      expect.objectContaining({
        privy_user_id: "did:privy:user-1",
      }),
    );
    expect(session.creatorId).toBe("creator-telegram");
  });

  it("does not overwrite a Telegram creator already claimed by another Privy user", async () => {
    vi.mocked(getCreatorByPrivyUserId).mockResolvedValue(null);
    getPrivyUserMock.mockResolvedValue({
      id: "did:privy:user-1",
      linked_accounts: [
        {
          type: "telegram",
          telegram_user_id: "7327569952",
        },
      ],
    });
    vi.mocked(findCreatorByTelegram).mockResolvedValue({
      id: "creator-telegram",
      privy_user_id: "did:privy:someone-else",
      telegram_chat_id: "7327569952",
    } as never);

    const session = await authenticateAccessToken("access-token");

    expect(updateCreator).not.toHaveBeenCalled();
    expect(session.creatorId).toBeNull();
  });

  it("returns a creator resolution error instead of failing auth when creator lookup is unavailable", async () => {
    vi.mocked(getCreatorByPrivyUserId).mockRejectedValue({
      code: "PGRST002",
      message: "Could not query the database for the schema cache. Retrying.",
    });

    const session = await authenticateAccessToken("access-token");

    expect(session).toMatchObject({
      accessToken: "access-token",
      privyUserId: "did:privy:user-1",
      creatorId: null,
    });
    expect(session.creatorResolutionError?.message).toBe(
      CREATOR_SERVICE_UNAVAILABLE_MESSAGE,
    );
  });
});
