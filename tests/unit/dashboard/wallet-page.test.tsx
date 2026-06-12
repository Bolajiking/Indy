// @vitest-environment jsdom

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "./test-helpers";

vi.mock("../../../dashboard/node_modules/next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../../../dashboard/src/components/dashboard-auth-gate", () => ({
  DashboardAuthGate: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock("../../../dashboard/src/lib/use-authed-query", () => ({
  useAuthedQuery: vi.fn(),
}));

vi.mock("../../../dashboard/src/lib/api", async () => {
  const actual = await vi.importActual<
    typeof import("../../../dashboard/src/lib/api")
  >("../../../dashboard/src/lib/api");

  return {
    ...actual,
    fetchPaymentAttempts: vi.fn(),
    fetchTransactions: vi.fn(),
    fetchWalletBalance: vi.fn(),
  };
});

import WalletPage from "../../../dashboard/src/app/dashboard/wallet/page";
import {
  fetchPaymentAttempts,
  fetchTransactions,
  fetchWalletBalance,
} from "../../../dashboard/src/lib/api";
import { useAuthedQuery } from "../../../dashboard/src/lib/use-authed-query";

const TRANSACTIONS = [
  {
    id: "txn-pending",
    type: "debit",
    amount_cents: 250,
    currency: "USD",
    description: "Brand research",
    service: "stableenrich",
    status: "pending",
    created_at: "2026-03-21T09:30:00.000Z",
  },
  {
    id: "txn-failed",
    type: "debit",
    amount_cents: 500,
    currency: "USD",
    description: "Email outreach",
    service: "mailer",
    status: "failed",
    error: "Insufficient testnet balance",
    created_at: "2026-03-21T10:30:00.000Z",
  },
];

const PAYMENT_ATTEMPTS = [
  {
    id: "attempt-1",
    service_url: "https://paid.example.com/search",
    service_host: "paid.example.com",
    method: "tempo",
    intent: "charge",
    currency: "0x20c0000000000000000000000000000000000000",
    quoted_amount_cents: 250,
    actual_amount_cents: null,
    status: "challenge_created",
    challenge_id: "challenge-1",
    receipt_reference: null,
    tx_hash: null,
    error: null,
    created_at: "2026-03-21T09:45:00.000Z",
    updated_at: "2026-03-21T09:45:00.000Z",
  },
  {
    id: "attempt-2",
    service_url: "https://paid.example.com/enrich",
    service_host: "paid.example.com",
    method: "tempo",
    intent: "charge",
    currency: "0x20c0000000000000000000000000000000000000",
    quoted_amount_cents: 500,
    actual_amount_cents: null,
    status: "failed",
    challenge_id: "challenge-2",
    receipt_reference: null,
    tx_hash: null,
    error: "Spending limit exceeded",
    created_at: "2026-03-21T10:45:00.000Z",
    updated_at: "2026-03-21T10:45:00.000Z",
  },
];

describe("WalletPage", () => {
  it("explains sandbox funding and surfaces pending/failed transaction states", () => {
    vi.mocked(useAuthedQuery).mockImplementation((queryFn: unknown) => {
      if (queryFn === fetchTransactions) {
        return {
          data: TRANSACTIONS,
          error: null,
          isLoading: false,
          refresh: vi.fn(),
        };
      }
      if (queryFn === fetchPaymentAttempts) {
        return {
          data: PAYMENT_ATTEMPTS,
          error: null,
          isLoading: false,
          refresh: vi.fn(),
        };
      }
      if (queryFn === fetchWalletBalance) {
        return {
          data: {
            balanceCents: 200,
            balanceFormatted: "$2.00",
            walletAddress: "0xabc123",
            fundingMode: "tempo_testnet_faucet",
            lowBalance: true,
            minimumRecommendedBalanceCents: 500,
            network: {
              name: "Tempo Testnet (Moderato)",
              chainId: 42431,
              rpcUrl: "https://rpc.moderato.tempo.xyz",
              currency: "pathUSD",
              tokenAddress: "0x20c0000000000000000000000000000000000000",
              tokenDecimals: 6,
            },
            fundingInstructions: {
              title: "Tempo testnet sandbox funding",
              description:
                "Use the Tempo testnet faucet for sandbox pathUSD. Do not treat this as production money.",
              faucetRpcMethod: "tempo_fundAddress",
            },
          },
          error: null,
          isLoading: false,
          refresh: vi.fn(),
        };
      }
      return { data: null, error: null, isLoading: false, refresh: vi.fn() };
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const { unmount } = render(React.createElement(WalletPage), container);

    const text = container.textContent ?? "";
    expect(text).toContain("Money you control");
    expect(text).toContain("$2.00");
    expect(text).toContain("Low balance");
    expect(text).toContain("Sandbox funding");
    expect(text).toContain("Tempo Testnet (Moderato)");
    expect(text).toContain("0xabc1");
    expect(text).toContain("Agent payments");
    expect(text).toContain("paid.example.com");
    expect(text).toContain("challenge created");
    expect(text).toContain("Spending limit exceeded");
    expect(text.toLowerCase()).toContain("pending");
    expect(text.toLowerCase()).toContain("failed");
    expect(text).toContain("Brand research");
    expect(text).toContain("Email outreach");
    expect(text).toContain("Insufficient testnet balance");

    unmount();
    container.remove();
  });
});
