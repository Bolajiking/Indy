import { SPENDING_LIMITS } from "../config/constants.js";
import { getTotalSpendToday } from "../db/queries/transactions.js";

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

export async function checkSpendingLimits(creatorId: string): Promise<void> {
  const todaySpendCents = await getTotalSpendToday(creatorId);
  if (todaySpendCents >= SPENDING_LIMITS.DAILY_USD * 100) {
    throw new SpendingLimitExceeded("daily", todaySpendCents, SPENDING_LIMITS.DAILY_USD * 100);
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
