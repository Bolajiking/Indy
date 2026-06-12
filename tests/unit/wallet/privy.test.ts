import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  walletsGetMock,
  walletsCreateMock,
  policiesGetMock,
  policiesCreateMock,
  singleMock,
  eqMock,
  selectMock,
  fromMock,
} = vi.hoisted(() => ({
  walletsGetMock: vi.fn(),
  walletsCreateMock: vi.fn(),
  policiesGetMock: vi.fn(),
  policiesCreateMock: vi.fn(),
  singleMock: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@privy-io/node", () => ({
  PrivyClient: class {
    policies() {
      return {
        get: policiesGetMock,
        create: policiesCreateMock,
      };
    }

    wallets() {
      return {
        get: walletsGetMock,
        create: walletsCreateMock,
        ethereum: () => ({
          signMessage: vi.fn(),
          signSecp256k1: vi.fn(),
          signTypedData: vi.fn(),
        }),
      };
    }
  },
}));

vi.mock("../../../src/config/env.js", () => ({
  env: {
    PRIVY_APP_ID: "app-id",
    PRIVY_APP_SECRET: "app-secret",
    PRIVY_JWT_VERIFICATION_KEY: "",
  },
}));

vi.mock("../../../src/db/client.js", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("../../../src/db/queries/creators.js", () => ({
  updateCreator: vi.fn(),
}));

vi.mock("../../../src/wallet/privy-provisioning.js", () => ({
  buildAgentWalletCreateParams: vi.fn((policyId: string) => ({
    chain_type: "ethereum",
    policy_ids: [policyId],
  })),
  buildAgentWalletPolicyDefinition: vi.fn((creatorId: string) => ({
    version: "1.0",
    name: `policy-${creatorId}`,
    chain_type: "ethereum",
    rules: [],
  })),
}));

import { updateCreator } from "../../../src/db/queries/creators.js";
import { createWalletForCreator } from "../../../src/wallet/privy.js";

describe("createWalletForCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqMock.mockReturnValue({ single: singleMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });
  });

  it("reuses a stored wallet when Privy confirms it is valid", async () => {
    singleMock.mockResolvedValue({
      data: {
        id: "creator-1",
        telegram_chat_id: "123",
        whatsapp_phone: null,
        display_name: "Ada Creator",
        wallet_id: "wallet-real",
        wallet_address: "0xabcDEF",
        settings: {},
      },
      error: null,
    });
    walletsGetMock.mockResolvedValue({
      id: "wallet-real",
      address: "0xabcdef",
    });

    const wallet = await createWalletForCreator("creator-1");

    expect(wallet).toEqual({
      walletId: "wallet-real",
      address: "0xabcDEF",
    });
    expect(walletsGetMock).toHaveBeenCalledWith("wallet-real");
    expect(policiesCreateMock).not.toHaveBeenCalled();
    expect(walletsCreateMock).not.toHaveBeenCalled();
    expect(updateCreator).not.toHaveBeenCalled();
  });

  it("reprovisions a new wallet when the stored wallet id is invalid", async () => {
    singleMock.mockResolvedValue({
      data: {
        id: "creator-2",
        telegram_chat_id: "456",
        whatsapp_phone: null,
        display_name: "Bola Creator",
        wallet_id: "test-wallet-id",
        wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
        settings: {},
      },
      error: null,
    });
    walletsGetMock.mockRejectedValue(
      Object.assign(new Error("Invalid wallet ID"), {
        status: 400,
        error: { code: "invalid_data" },
      }),
    );
    policiesCreateMock.mockResolvedValue({ id: "policy-1" });
    walletsCreateMock.mockResolvedValue({
      id: "wallet-live",
      address: "0x9999999999999999999999999999999999999999",
    });
    vi.mocked(updateCreator).mockResolvedValue({} as never);

    const wallet = await createWalletForCreator("creator-2");

    expect(walletsGetMock).toHaveBeenCalledWith("test-wallet-id");
    expect(policiesCreateMock).toHaveBeenCalledTimes(1);
    expect(walletsCreateMock).toHaveBeenCalledWith({
      chain_type: "ethereum",
      policy_ids: ["policy-1"],
    });
    expect(updateCreator).toHaveBeenCalledWith(
      "creator-2",
      expect.objectContaining({
        wallet_id: "wallet-live",
        wallet_address: "0x9999999999999999999999999999999999999999",
        settings: expect.objectContaining({
          privy_policy_id: "policy-1",
          wallet_mode: "agentic",
        }),
      }),
    );
    expect(wallet).toEqual({
      walletId: "wallet-live",
      address: "0x9999999999999999999999999999999999999999",
    });
  });

  it("surfaces validation connection errors instead of treating them as stale wallets", async () => {
    singleMock.mockResolvedValue({
      data: {
        id: "creator-3",
        telegram_chat_id: "789",
        whatsapp_phone: null,
        display_name: "Caro Creator",
        wallet_id: "wallet-maybe-real",
        wallet_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        settings: {},
      },
      error: null,
    });
    walletsGetMock.mockRejectedValue(new Error("network down"));

    await expect(createWalletForCreator("creator-3")).rejects.toThrow(
      "network down",
    );
    expect(policiesCreateMock).not.toHaveBeenCalled();
    expect(walletsCreateMock).not.toHaveBeenCalled();
    expect(updateCreator).not.toHaveBeenCalled();
  });
});
