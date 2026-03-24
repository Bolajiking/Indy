import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/queries/creators.js", () => ({
  getCreatorById: vi.fn(),
  updateCreator: vi.fn(),
}));

vi.mock("../../../src/wallet/privy.js", () => ({
  createWalletForCreator: vi.fn(),
}));

import {
  getCreatorById,
  updateCreator,
} from "../../../src/db/queries/creators.js";
import { createWalletForCreator } from "../../../src/wallet/privy.js";
import {
  ensureCreatorWalletProvisioning,
  getWalletOnboardingMetadata,
} from "../../../src/wallet/provisioning.js";

describe("wallet provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks wallet onboarding active after a successful provisioning retry", async () => {
    vi.mocked(getCreatorById)
      .mockResolvedValueOnce({
        id: "creator-1",
        display_name: "Ada",
        wallet_id: null,
        wallet_address: null,
        settings: {},
      } as never)
      .mockResolvedValueOnce({
        id: "creator-1",
        display_name: "Ada",
        wallet_id: "wallet-1",
        wallet_address: "0xabc",
        settings: {
          onboarding_status: "wallet_pending",
          wallet_provisioning_in_progress: true,
          wallet_provisioning_attempts: 1,
        },
      } as never)
      .mockResolvedValueOnce({
        id: "creator-1",
        display_name: "Ada",
        wallet_id: "wallet-1",
        wallet_address: "0xabc",
        settings: {
          onboarding_status: "active",
          wallet_provisioning_in_progress: false,
          wallet_provisioning_attempts: 1,
        },
      } as never);
    vi.mocked(updateCreator).mockImplementation(async (id, updates) => ({
      id,
      display_name: "Ada",
      wallet_id: null,
      wallet_address: null,
      settings: updates.settings ?? {},
    }) as never);
    vi.mocked(createWalletForCreator).mockResolvedValue({
      walletId: "wallet-1",
      address: "0xabc",
    });

    const result = await ensureCreatorWalletProvisioning("creator-1", {
      force: true,
      awaitCompletion: true,
      source: "test",
    });

    expect(result.started).toBe(true);
    expect(updateCreator).toHaveBeenNthCalledWith(
      1,
      "creator-1",
      expect.objectContaining({
        settings: expect.objectContaining({
          onboarding_status: "wallet_pending",
          wallet_provisioning_in_progress: true,
          wallet_provisioning_attempts: 1,
          onboarding_error: null,
          wallet_provisioning_source: "test",
        }),
      })
    );
    expect(updateCreator).toHaveBeenNthCalledWith(
      2,
      "creator-1",
      expect.objectContaining({
        settings: expect.objectContaining({
          onboarding_status: "active",
          wallet_provisioning_in_progress: false,
          wallet_provisioning_attempts: 1,
          onboarding_error: null,
        }),
      })
    );
  });

  it("returns creators to wallet_pending with an error when Privy provisioning fails", async () => {
    vi.mocked(getCreatorById)
      .mockResolvedValueOnce({
        id: "creator-2",
        display_name: "Bola",
        wallet_id: null,
        wallet_address: null,
        settings: {},
      } as never)
      .mockResolvedValueOnce({
        id: "creator-2",
        display_name: "Bola",
        wallet_id: null,
        wallet_address: null,
        settings: {
          onboarding_status: "wallet_pending",
          wallet_provisioning_in_progress: true,
          wallet_provisioning_attempts: 1,
        },
      } as never);
    vi.mocked(updateCreator).mockImplementation(async (id, updates) => ({
      id,
      display_name: "Bola",
      wallet_id: null,
      wallet_address: null,
      settings: updates.settings ?? {},
    }) as never);
    vi.mocked(createWalletForCreator).mockRejectedValue(new Error("Privy down"));

    const result = await ensureCreatorWalletProvisioning("creator-2", {
      force: true,
      awaitCompletion: true,
      source: "test",
    });

    expect(result.started).toBe(true);
    expect(updateCreator).toHaveBeenNthCalledWith(
      2,
      "creator-2",
      expect.objectContaining({
        settings: expect.objectContaining({
          onboarding_status: "wallet_pending",
          wallet_provisioning_in_progress: false,
          onboarding_error: "Privy down",
        }),
      })
    );
  });

  it("does not immediately retry when a recent attempt is still cooling down", async () => {
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-3",
      display_name: "Caro",
      wallet_id: null,
      wallet_address: null,
      settings: {
        onboarding_status: "wallet_pending",
        wallet_provisioning_in_progress: false,
        wallet_provisioning_attempts: 1,
        wallet_provisioning_last_attempt_at: new Date().toISOString(),
      },
    } as never);

    const result = await ensureCreatorWalletProvisioning("creator-3");

    expect(result.started).toBe(false);
    expect(createWalletForCreator).not.toHaveBeenCalled();
    expect(updateCreator).not.toHaveBeenCalled();
  });

  it("retries again when a persisted in-progress flag is stale", async () => {
    const staleAttemptAt = new Date(Date.now() - 5 * 60_000).toISOString();
    vi.mocked(getCreatorById)
      .mockResolvedValueOnce({
        id: "creator-4",
        display_name: "Dee",
        wallet_id: null,
        wallet_address: null,
        settings: {
          onboarding_status: "wallet_pending",
          wallet_provisioning_in_progress: true,
          wallet_provisioning_attempts: 2,
          wallet_provisioning_last_attempt_at: staleAttemptAt,
        },
      } as never)
      .mockResolvedValueOnce({
        id: "creator-4",
        display_name: "Dee",
        wallet_id: "wallet-4",
        wallet_address: "0x444",
        settings: {
          onboarding_status: "wallet_pending",
          wallet_provisioning_in_progress: true,
          wallet_provisioning_attempts: 3,
          wallet_provisioning_last_attempt_at: new Date().toISOString(),
        },
      } as never)
      .mockResolvedValueOnce({
        id: "creator-4",
        display_name: "Dee",
        wallet_id: "wallet-4",
        wallet_address: "0x444",
        settings: {
          onboarding_status: "active",
          wallet_provisioning_in_progress: false,
          wallet_provisioning_attempts: 3,
        },
      } as never);
    vi.mocked(updateCreator).mockImplementation(async (id, updates) => ({
      id,
      display_name: "Dee",
      wallet_id: null,
      wallet_address: null,
      settings: updates.settings ?? {},
    }) as never);
    vi.mocked(createWalletForCreator).mockResolvedValue({
      walletId: "wallet-4",
      address: "0x444",
    });

    const result = await ensureCreatorWalletProvisioning("creator-4", {
      awaitCompletion: true,
      source: "test",
    });

    expect(result.started).toBe(true);
    expect(createWalletForCreator).toHaveBeenCalledWith("creator-4");
  });

  it("deduplicates concurrent provisioning starts for the same creator", async () => {
    let resolveStart!: (creator: unknown) => void;
    const startPromise = new Promise((resolve) => {
      resolveStart = resolve;
    });

    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-5",
      display_name: "Efe",
      wallet_id: null,
      wallet_address: null,
      settings: {},
    } as never);
    vi.mocked(updateCreator).mockImplementationOnce(
      () =>
        startPromise as Promise<never>
    );
    vi.mocked(updateCreator).mockImplementation(async (id, updates) => ({
      id,
      display_name: "Efe",
      wallet_id: null,
      wallet_address: null,
      settings: updates.settings ?? {},
    }) as never);
    vi.mocked(createWalletForCreator).mockResolvedValue({
      walletId: "wallet-5",
      address: "0x555",
    });

    const first = ensureCreatorWalletProvisioning("creator-5", {
      force: true,
      source: "test",
    });
    await Promise.resolve();
    const second = await ensureCreatorWalletProvisioning("creator-5", {
      force: true,
      source: "test",
    });

    expect(second.started).toBe(false);
    expect(second.reason).toBe("already_in_progress");
    expect(updateCreator).toHaveBeenCalledTimes(1);

    resolveStart({
      id: "creator-5",
      display_name: "Efe",
      wallet_id: null,
      wallet_address: null,
      settings: {
        onboarding_status: "wallet_pending",
        wallet_provisioning_in_progress: true,
        wallet_provisioning_attempts: 1,
      },
    });

    await first;
    expect(createWalletForCreator).toHaveBeenCalledTimes(1);
  });

  it("reads provisioning metadata from creator settings", () => {
    expect(
      getWalletOnboardingMetadata({
        settings: {
          onboarding_status: "wallet_pending",
          wallet_provisioning_in_progress: true,
          wallet_provisioning_attempts: 2,
          onboarding_error: "timeout",
        },
      } as never)
    ).toEqual({
      status: "wallet_pending",
      walletProvisioned: false,
      onboardingComplete: false,
      walletProvisioningInProgress: true,
      walletProvisioningAttempts: 2,
      walletProvisioningLastError: "timeout",
    });
  });
});
