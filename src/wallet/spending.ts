import { NETWORK, SPENDING_LIMITS } from "../config/constants.js";
import { getCreatorById } from "../db/queries/creators.js";
import type { JsonObject } from "../db/json.js";
import { formatUsd } from "../lib/format.js";
import {
  getTotalSpendThisMonth,
  getTotalSpendToday,
} from "../db/queries/transactions.js";

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

export function resolveCreatorSpendingLimits(
  creator: {
    settings?: JsonObject | null;
  } | null,
): CreatorSpendingLimits {
  const configured = creator?.settings?.spending_limits;
  const limits =
    typeof configured === "object" &&
    configured !== null &&
    !Array.isArray(configured)
      ? configured
      : null;

  return {
    perTransactionCents: normalizeLimit(
      limits?.per_transaction_cents,
      SPENDING_LIMITS.PER_TRANSACTION_USD * 100,
    ),
    dailyCents: normalizeLimit(
      limits?.daily_cents,
      SPENDING_LIMITS.DAILY_USD * 100,
    ),
    monthlyCents: normalizeLimit(
      limits?.monthly_cents,
      SPENDING_LIMITS.MONTHLY_USD * 100,
    ),
  };
}

export class SpendingLimitExceeded extends Error {
  constructor(
    public limit: string,
    public current: number,
    public max: number,
  ) {
    super(
      `Spending limit exceeded: ${limit}. Current: ${formatUsd(current)}, Max: ${formatUsd(max)}`,
    );
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

  return extractTempoAmountCents(amount, currency);
}

export function extractTempoAmountCents(
  amount: string,
  currency: string,
): number | null {
  if (
    currency.toLowerCase() !== NETWORK.TEMPO.PATH_USD_CONTRACT.toLowerCase()
  ) {
    return null;
  }

  const normalizedAmount = amount.trim();
  if (!/^\d+$/.test(normalizedAmount)) {
    return null;
  }

  const baseUnits = BigInt(normalizedAmount);
  const centsMultiplier = BigInt(100);
  const divisor = BigInt(10) ** BigInt(NETWORK.TEMPO.PATH_USD_DECIMALS);
  const rounded = (baseUnits * centsMultiplier + divisor / BigInt(2)) / divisor;

  return Number(rounded);
}

export async function enforcePerTransactionLimit(
  creatorId: string,
  quotedAmountCents: number,
): Promise<void> {
  const creator = await getCreatorById(creatorId);
  const limits = resolveCreatorSpendingLimits(creator);

  if (quotedAmountCents > limits.perTransactionCents) {
    throw new SpendingLimitExceeded(
      "per_transaction",
      quotedAmountCents,
      limits.perTransactionCents,
    );
  }
}

export async function checkSpendingLimits(creatorId: string): Promise<void> {
  const creator = await getCreatorById(creatorId);
  const limits = resolveCreatorSpendingLimits(creator);
  const todaySpendCents = await getTotalSpendToday(creatorId);
  if (todaySpendCents >= limits.dailyCents) {
    throw new SpendingLimitExceeded(
      "daily",
      todaySpendCents,
      limits.dailyCents,
    );
  }

  const monthSpendCents = await getTotalSpendThisMonth(creatorId);
  if (monthSpendCents >= limits.monthlyCents) {
    throw new SpendingLimitExceeded(
      "monthly",
      monthSpendCents,
      limits.monthlyCents,
    );
  }
}

/**
 * Enforce daily/monthly limits *inclusive of the charge about to happen*.
 * The pre-flight `checkSpendingLimits` only knows prior spend; this runs once
 * the quoted amount is known (on-challenge) so a single charge can never push
 * cumulative spend past a hard limit — the "limits Indyfren can never cross"
 * guarantee the UI makes.
 */
export async function enforceCumulativeLimits(
  creatorId: string,
  quotedAmountCents: number,
): Promise<void> {
  const creator = await getCreatorById(creatorId);
  const limits = resolveCreatorSpendingLimits(creator);

  const todaySpendCents = await getTotalSpendToday(creatorId);
  if (todaySpendCents + quotedAmountCents > limits.dailyCents) {
    throw new SpendingLimitExceeded(
      "daily",
      todaySpendCents + quotedAmountCents,
      limits.dailyCents,
    );
  }

  const monthSpendCents = await getTotalSpendThisMonth(creatorId);
  if (monthSpendCents + quotedAmountCents > limits.monthlyCents) {
    throw new SpendingLimitExceeded(
      "monthly",
      monthSpendCents + quotedAmountCents,
      limits.monthlyCents,
    );
  }
}

export function canAffordTransaction(
  amountCents: number,
  freeCreditsRemainingCents: number,
  walletBalanceCents: number,
): { canAfford: boolean; useCredits: boolean; shortfall: number } {
  if (freeCreditsRemainingCents >= amountCents) {
    return { canAfford: true, useCredits: true, shortfall: 0 };
  }
  const totalAvailable = freeCreditsRemainingCents + walletBalanceCents;
  if (totalAvailable >= amountCents) {
    return {
      canAfford: true,
      useCredits: freeCreditsRemainingCents > 0,
      shortfall: 0,
    };
  }
  return {
    canAfford: false,
    useCredits: false,
    shortfall: amountCents - totalAvailable,
  };
}
