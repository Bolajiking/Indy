import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/wallet/privy.js", () => ({
  createPrivyAccount: vi.fn(),
}));

vi.mock("../../../src/db/queries/transactions.js", () => ({
  logTransaction: vi.fn(),
}));

vi.mock("../../../src/db/queries/payment-attempts.js", () => ({
  createPaymentAttempt: vi.fn(),
  updatePaymentAttempt: vi.fn(),
}));

vi.mock("../../../src/wallet/spending.js", () => ({
  checkSpendingLimits: vi.fn(),
  enforcePerTransactionLimit: vi.fn(),
  extractQuotedAmountCents: vi.fn(),
}));

import {
  parsePaymentReceiptHeader,
  resolvePaymentReceipt,
} from "../../../src/wallet/mpp.js";

function encodeReceipt(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

describe("MPP receipt parsing", () => {
  it("parses the official Payment-Receipt header", () => {
    const receipt = parsePaymentReceiptHeader(
      encodeReceipt({
        method: "tempo",
        status: "success",
        timestamp: "2026-06-03T10:00:00.000Z",
        reference: "0xtx",
      }),
    );

    expect(receipt).toEqual({
      method: "tempo",
      status: "success",
      timestamp: "2026-06-03T10:00:00.000Z",
      reference: "0xtx",
    });
  });

  it("resolves the official Payment-Receipt header from a response", () => {
    const response = new Response(null, {
      headers: {
        "Payment-Receipt": encodeReceipt({
          method: "tempo",
          status: "success",
          timestamp: "2026-06-03T10:00:00.000Z",
          reference: "0xofficial",
        }),
      },
    });

    expect(resolvePaymentReceipt(response)).toEqual({
      method: "tempo",
      status: "success",
      timestamp: "2026-06-03T10:00:00.000Z",
      reference: "0xofficial",
    });
  });

  it("preserves optional receipt amount and currency for reconciliation", () => {
    const receipt = parsePaymentReceiptHeader(
      encodeReceipt({
        method: "tempo",
        status: "success",
        timestamp: "2026-06-03T10:00:00.000Z",
        reference: "0xtx",
        amount: "2500000",
        currency: "0x20c0000000000000000000000000000000000000",
      }),
    );

    expect(receipt).toEqual({
      method: "tempo",
      status: "success",
      timestamp: "2026-06-03T10:00:00.000Z",
      reference: "0xtx",
      amount: "2500000",
      currency: "0x20c0000000000000000000000000000000000000",
    });
  });
});
