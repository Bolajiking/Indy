import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/db/queries/creators.js", () => ({
  getCreatorById: vi.fn(),
}));

vi.mock("../../../src/db/queries/transactions.js", () => ({
  getTotalSpendToday: vi.fn(),
  getTotalSpendThisMonth: vi.fn(),
}));

import { getCreatorById } from "../../../src/db/queries/creators.js";
import {
  getTotalSpendToday,
  getTotalSpendThisMonth,
} from "../../../src/db/queries/transactions.js";
import {
  extractQuotedAmountCents,
  SpendingLimitExceeded,
  checkSpendingLimits,
  enforcePerTransactionLimit,
  resolveCreatorSpendingLimits,
} from "../../../src/wallet/spending.js";

describe("resolveCreatorSpendingLimits", () => {
  it("merges creator overrides with default platform spending limits", () => {
    const limits = resolveCreatorSpendingLimits({
      settings: {
        spending_limits: {
          daily_cents: 1200,
          monthly_cents: 4200,
        },
      },
    } as never);

    expect(limits).toEqual({
      perTransactionCents: 500,
      dailyCents: 1200,
      monthlyCents: 4200,
    });
  });

  it("uses creator-specific per-transaction limits when configured", () => {
    const limits = resolveCreatorSpendingLimits({
      settings: {
        spending_limits: {
          per_transaction_cents: 275,
        },
      },
    } as never);

    expect(limits.perTransactionCents).toBe(275);
  });
});

describe("checkSpendingLimits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses creator-specific daily and monthly limits", async () => {
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-1",
      settings: {
        spending_limits: {
          daily_cents: 2000,
          monthly_cents: 5000,
        },
      },
    } as never);
    vi.mocked(getTotalSpendToday).mockResolvedValue(1500);
    vi.mocked(getTotalSpendThisMonth).mockResolvedValue(3000);

    await expect(checkSpendingLimits("creator-1")).resolves.toBeUndefined();
  });

  it("throws when the creator has reached their configured monthly limit", async () => {
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-1",
      settings: {
        spending_limits: {
          daily_cents: 4000,
          monthly_cents: 2500,
        },
      },
    } as never);
    vi.mocked(getTotalSpendToday).mockResolvedValue(500);
    vi.mocked(getTotalSpendThisMonth).mockResolvedValue(2500);

    await expect(checkSpendingLimits("creator-1")).rejects.toEqual(
      expect.objectContaining<Partial<SpendingLimitExceeded>>({
        name: "SpendingLimitExceeded",
        limit: "monthly",
        current: 2500,
        max: 2500,
      })
    );
  });
});

describe("enforcePerTransactionLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows a quoted payment when it is within the configured per-transaction limit", async () => {
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-1",
      settings: {
        spending_limits: {
          per_transaction_cents: 750,
        },
      },
    } as never);

    await expect(enforcePerTransactionLimit("creator-1", 500)).resolves.toBeUndefined();
  });

  it("throws when the quoted payment exceeds the configured per-transaction limit", async () => {
    vi.mocked(getCreatorById).mockResolvedValue({
      id: "creator-1",
      settings: {
        spending_limits: {
          per_transaction_cents: 400,
        },
      },
    } as never);

    await expect(enforcePerTransactionLimit("creator-1", 500)).rejects.toEqual(
      expect.objectContaining<Partial<SpendingLimitExceeded>>({
        name: "SpendingLimitExceeded",
        limit: "per_transaction",
        current: 500,
        max: 400,
      })
    );
  });
});

describe("extractQuotedAmountCents", () => {
  it("converts a Tempo PATH USD quote from base units into USD cents", () => {
    expect(
      extractQuotedAmountCents({
        method: "tempo",
        request: {
          amount: "2500000",
          currency: "0x20c0000000000000000000000000000000000000",
        },
      } as never)
    ).toBe(250);
  });

  it("returns null when the challenge does not expose a supported quoted amount", () => {
    expect(
      extractQuotedAmountCents({
        method: "tempo",
        request: {
          amount: "2500000",
          currency: "0xnot-supported",
        },
      } as never)
    ).toBeNull();
  });
});
