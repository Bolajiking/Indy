import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("mppx/client", () => ({
  Mppx: {
    create: vi.fn(),
    restore: vi.fn(),
  },
  tempo: vi.fn(),
}));

vi.mock("../../../src/wallet/privy.js", () => ({
  createPrivyAccount: vi.fn(),
}));

vi.mock("../../../src/db/queries/transactions.js", () => ({
  logTransaction: vi.fn(),
}));

vi.mock("../../../src/wallet/spending.js", () => ({
  checkSpendingLimits: vi.fn(),
  enforcePerTransactionLimit: vi.fn(),
  extractQuotedAmountCents: vi.fn(),
}));

import { Mppx, tempo } from "mppx/client";
import {
  createMppClient,
  installMppFetchPolyfill,
} from "../../../src/wallet/mpp.js";
import { createPrivyAccount } from "../../../src/wallet/privy.js";
import {
  checkSpendingLimits,
  enforcePerTransactionLimit,
  extractQuotedAmountCents,
} from "../../../src/wallet/spending.js";

describe("createMppClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an mppx client backed by a Privy account", async () => {
    const account = { address: "0x123" };
    const method = { name: "tempo-method" };
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const createCredential = vi.fn().mockResolvedValue("credential");

    vi.mocked(createPrivyAccount).mockReturnValue(account as never);
    vi.mocked(tempo).mockReturnValue([method, { name: "session-method" }] as never);
    vi.mocked(extractQuotedAmountCents).mockReturnValue(250);
    vi.mocked(Mppx.create).mockReturnValue({
      fetch: fetchMock,
      rawFetch: fetch,
      methods: [method],
      transport: {} as never,
      createCredential,
    } as never);

    const client = await createMppClient("creator-1", "wallet-1", "0x123");
    await client.fetch("https://example.com");

    const config = vi.mocked(Mppx.create).mock.calls[0]?.[0];
    const credential = await config?.onChallenge?.(
      {
        method: "tempo",
        request: {
          amount: "2500000",
          currency: "0x20c0000000000000000000000000000000000000",
        },
      } as never,
      { createCredential }
    );

    expect(createPrivyAccount).toHaveBeenCalledWith("wallet-1", "0x123");
    expect(tempo).toHaveBeenCalledWith(
      expect.objectContaining({
        account,
        getClient: expect.any(Function),
      })
    );
    expect(Mppx.create).toHaveBeenCalledWith({
      onChallenge: expect.any(Function),
      polyfill: false,
      methods: [[method, { name: "session-method" }]],
    });
    expect(checkSpendingLimits).toHaveBeenCalledWith("creator-1");
    expect(extractQuotedAmountCents).toHaveBeenCalled();
    expect(enforcePerTransactionLimit).toHaveBeenCalledWith("creator-1", 250);
    expect(createCredential).toHaveBeenCalled();
    expect(credential).toBe("credential");
    expect(fetchMock).toHaveBeenCalledWith("https://example.com", undefined);
  });

  it("blocks quoted payments that exceed the per-transaction limit before credential creation", async () => {
    const account = { address: "0x123" };
    const method = { name: "tempo-method" };
    const createCredential = vi.fn().mockResolvedValue("credential");

    vi.mocked(createPrivyAccount).mockReturnValue(account as never);
    vi.mocked(tempo).mockReturnValue([method, { name: "session-method" }] as never);
    vi.mocked(extractQuotedAmountCents).mockReturnValue(900);
    vi.mocked(enforcePerTransactionLimit).mockRejectedValue(
      new Error("per-transaction limit exceeded")
    );
    vi.mocked(Mppx.create).mockReturnValue({
      fetch: vi.fn(),
      rawFetch: fetch,
      methods: [method],
      transport: {} as never,
      createCredential,
    } as never);

    await createMppClient("creator-1", "wallet-1", "0x123");

    const config = vi.mocked(Mppx.create).mock.calls[0]?.[0];

    await expect(
      config?.onChallenge?.(
        {
          method: "tempo",
          request: {
            amount: "9000000",
            currency: "0x20c0000000000000000000000000000000000000",
          },
        } as never,
        { createCredential }
      )
    ).rejects.toThrow("per-transaction limit exceeded");
    expect(createCredential).not.toHaveBeenCalled();
  });

  it("blocks paid calls when the challenge does not expose a usable quote", async () => {
    const account = { address: "0x123" };
    const method = { name: "tempo-method" };
    const createCredential = vi.fn().mockResolvedValue("credential");

    vi.mocked(createPrivyAccount).mockReturnValue(account as never);
    vi.mocked(tempo).mockReturnValue([method, { name: "session-method" }] as never);
    vi.mocked(extractQuotedAmountCents).mockReturnValue(null);
    vi.mocked(Mppx.create).mockReturnValue({
      fetch: vi.fn(),
      rawFetch: fetch,
      methods: [method],
      transport: {} as never,
      createCredential,
    } as never);

    await createMppClient("creator-1", "wallet-1", "0x123");

    const config = vi.mocked(Mppx.create).mock.calls[0]?.[0];

    await expect(
      config?.onChallenge?.(
        {
          method: "tempo",
          request: {
            amount: "9000000",
            currency: "0xnot-supported",
          },
        } as never,
        { createCredential }
      )
    ).rejects.toThrow("Unable to determine quoted payment amount");
    expect(createCredential).not.toHaveBeenCalled();
  });

  it("installs a global fetch polyfill client for Tempo-backed paid requests", async () => {
    const account = { address: "0x123" };
    const method = { name: "tempo-method" };
    const createCredential = vi.fn().mockResolvedValue("credential");

    vi.mocked(createPrivyAccount).mockReturnValue(account as never);
    vi.mocked(tempo).mockReturnValue([method, { name: "session-method" }] as never);
    vi.mocked(extractQuotedAmountCents).mockReturnValue(125);
    vi.mocked(enforcePerTransactionLimit).mockResolvedValue(undefined as never);
    vi.mocked(Mppx.create).mockReturnValue({
      fetch: vi.fn(),
      rawFetch: fetch,
      methods: [method],
      transport: {} as never,
      createCredential,
    } as never);

    const client = await installMppFetchPolyfill("creator-1", "wallet-1", "0x123");

    const config = vi.mocked(Mppx.create).mock.calls[0]?.[0];
    const credential = await config?.onChallenge?.(
      {
        method: "tempo",
        request: {
          amount: "1250000",
          currency: "0x20c0000000000000000000000000000000000000",
        },
      } as never,
      { createCredential }
    );

    expect(Mppx.create).toHaveBeenCalledWith({
      onChallenge: expect.any(Function),
      polyfill: true,
      methods: [[method, { name: "session-method" }]],
    });
    expect(enforcePerTransactionLimit).toHaveBeenCalledWith("creator-1", 125);
    expect(createCredential).toHaveBeenCalled();
    expect(credential).toBe("credential");

    client.restore();
    expect(Mppx.restore).toHaveBeenCalled();
  });
});
