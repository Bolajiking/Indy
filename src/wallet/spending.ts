import { NETWORK, SPENDING_LIMITS } from "../config/constants.js";
import { getCreatorById } from "../db/queries/creators.js";
import { getTotalSpendThisMonth, getTotalSpendToday } from "../db/queries/transactions.js";

export interface CreatorSpendingLimits {
  perTransactionCents: number;
  dailyCents: number;
  monthlyCents: number;
}

function normalizeLimit(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.round(value);
  return normalized > 0 ? normalized : fallback;
}

export function resolveCreatorSpendingLimits(creator: {
  settings?: Record<string, any> | null;
} | null): CreatorSpendingLimits {
  const configured = creator?.settings?.spending_limits;

  return {
    perTransactionCents: normalizeLimit(
      configured?.per_transaction_cents,
      SPENDING_LIMITS.PER_TRANSACTION_USD * 100
    ),
    dailyCents: normalizeLimit(configured?.daily_cents, SPENDING_LIMITS.DAILY_USD * 100),
    monthlyCents: normalizeLimit(
      configured?.monthly_cents,
      SPENDING_LIMITS.MONTHLY_USD * 100
    ),
  };
}

export class SpendingLimitExceeded extends Error {
  constructor(
    public limit: string,
    public current: number,
    public max: number
  ) {
    super(`Spending limit exceeded: ${limit}. Current: $${(current / 100).toFixed(2)}, Max: $${(max / 100).toFixed(2)}`);
    this.name = "SpendingLimitExceeded";
  }
}

export function extractQuotedAmountCents(challenge: {
  method?: string;
  request?: Record<string, unknown>;
}): number | null {
  if (challenge.method !== "tempo") {
    return null;
  }

  const amount = challenge.request?.amount;
  const currency = challenge.request?.currency;

  if (typeof amount !== "string" || typeof currency !== "string") {
    return null;
  }

  if (currency.toLowerCase() !== NETWORK.TEMPO.PATH_USD_CONTRACT.toLowerCase()) {
    return null;
  }

  const normalizedAmount = amount.trim();
  if (!/^\d+$/.test(normalizedAmount)) {
    return null;
  }

  const baseUnits = BigInt(normalizedAmount);
  const centsMultiplier = 100n;
  const divisor = 10n ** BigInt(NETWORK.TEMPO.PATH_USD_DECIMALS);
  const rounded = (baseUnits * centsMultiplier + divisor / 2n) / divisor;

  return Number(rounded);
}

export async function enforcePerTransactionLimit(
  creatorId: string,
  quotedAmountCents: number
): Promise<void> {
  const creator = await getCreatorById(creatorId);
  const limits = resolveCreatorSpendingLimits(creator);

  if (quotedAmountCents > limits.perTransactionCents) {
    throw new SpendingLimitExceeded(
      "per_transaction",
      quotedAmountCents,
      limits.perTransactionCents
    );
  }
}

export async function checkSpendingLimits(creatorId: string): Promise<void> {
  const creator = await getCreatorById(creatorId);
  const limits = resolveCreatorSpendingLimits(creator);
  const todaySpendCents = await getTotalSpendToday(creatorId);
  if (todaySpendCents >= limits.dailyCents) {
    throw new SpendingLimitExceeded("daily", todaySpendCents, limits.dailyCents);
  }

  const monthSpendCents = await getTotalSpendThisMonth(creatorId);
  if (monthSpendCents >= limits.monthlyCents) {
    throw new SpendingLimitExceeded("monthly", monthSpendCents, limits.monthlyCents);
  }
}

export function canAffordTransaction(
  amountCents: number,
  freeCreditsRemainingCents: number,
  walletBalanceCents: number
): { canAfford: boolean; useCredits: boolean; shortfall: number } {
  if (freeCreditsRemainingCents >= amountCents) {
    return { canAfford: true, useCredits: true, shortfall: 0 };
  }
  const totalAvailable = freeCreditsRemainingCents + walletBalanceCents;
  if (totalAvailable >= amountCents) {
    return { canAfford: true, useCredits: freeCreditsRemainingCents > 0, shortfall: 0 };
  }
  return { canAfford: false, useCredits: false, shortfall: amountCents - totalAvailable };
}
