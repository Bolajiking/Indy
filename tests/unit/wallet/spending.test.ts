import { describe, it, expect } from "vitest";
import {
  canAffordTransaction,
  SpendingLimitExceeded,
} from "../../../src/wallet/spending.js";

describe("canAffordTransaction", () => {
  it("returns true when free credits cover the cost", () => {
    const result = canAffordTransaction(500, 1000, 0);
    expect(result.canAfford).toBe(true);
    expect(result.useCredits).toBe(true);
  });

  it("returns true when wallet balance covers after credits exhausted", () => {
    const result = canAffordTransaction(1500, 500, 2000);
    expect(result.canAfford).toBe(true);
    expect(result.useCredits).toBe(true);
  });

  it("returns false with shortfall when insufficient funds", () => {
    const result = canAffordTransaction(5000, 100, 200);
    expect(result.canAfford).toBe(false);
    expect(result.shortfall).toBe(4700);
  });

  it("returns true with no credits when wallet alone covers cost", () => {
    const result = canAffordTransaction(500, 0, 1000);
    expect(result.canAfford).toBe(true);
    expect(result.useCredits).toBe(false);
  });
});

describe("SpendingLimitExceeded", () => {
  it("formats error message with dollar amounts", () => {
    const err = new SpendingLimitExceeded("daily", 5000, 5000);
    expect(err.message).toContain("$50.00");
    expect(err.name).toBe("SpendingLimitExceeded");
  });
});
