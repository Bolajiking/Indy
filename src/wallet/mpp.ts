import { createPrivyAccount } from "./privy.js";
import { logTransaction } from "../db/queries/transactions.js";
import {
  createPaymentAttempt,
  updatePaymentAttempt,
} from "../db/queries/payment-attempts.js";
import {
  checkSpendingLimits,
  enforceCumulativeLimits,
  enforcePerTransactionLimit,
  extractQuotedAmountCents,
  extractTempoAmountCents,
} from "./spending.js";
import { Mppx, tempo } from "mppx/client";
import pino from "pino";
import { createClient, http, createPublicClient } from "viem";
import { tempo as tempoChain } from "viem/chains";
import { NETWORK } from "../config/constants.js";
import { toJsonValue } from "../db/json.js";
import { formatUsd } from "../lib/format.js";
import { ipv4Fetch } from "../network/ipv4-fetch.js";

const log = pino({ name: "wallet:mpp" });
const TEMPO_RPC_URL = "https://rpc.moderato.tempo.xyz";

type MppPaymentChallenge = Parameters<typeof extractQuotedAmountCents>[0];
type MppChallengeHelpers = {
  createCredential: () => Promise<string>;
};

export interface PaymentReceipt {
  method: string;
  reference: string;
  status: "success";
  timestamp: string;
  amount?: string;
  currency?: string;
  externalId?: string;
}

interface PaymentReceiptHeader {
  method: "tempo";
  reference: string;
  status: "success";
  timestamp: string;
  amount?: string;
  currency?: string;
  externalId?: string;
}

function isPaymentReceiptHeader(value: unknown): value is PaymentReceiptHeader {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const receipt = value as {
    method?: unknown;
    reference?: unknown;
    status?: unknown;
    timestamp?: unknown;
    amount?: unknown;
    currency?: unknown;
    externalId?: unknown;
  };

  return (
    receipt.method === "tempo" &&
    receipt.status === "success" &&
    typeof receipt.reference === "string" &&
    typeof receipt.timestamp === "string" &&
    (receipt.amount === undefined || typeof receipt.amount === "string") &&
    (receipt.currency === undefined || typeof receipt.currency === "string") &&
    (receipt.externalId === undefined || typeof receipt.externalId === "string")
  );
}

export function parsePaymentReceiptHeader(header: string): PaymentReceipt {
  const parsed: unknown = JSON.parse(
    Buffer.from(header, "base64url").toString("utf8"),
  );
  if (!isPaymentReceiptHeader(parsed)) {
    throw new Error("Invalid Payment-Receipt header");
  }

  return {
    method: parsed.method,
    reference: parsed.reference,
    status: parsed.status,
    timestamp: parsed.timestamp,
    ...(typeof parsed.amount === "string" ? { amount: parsed.amount } : {}),
    ...(typeof parsed.currency === "string"
      ? { currency: parsed.currency }
      : {}),
    ...(typeof parsed.externalId === "string"
      ? { externalId: parsed.externalId }
      : {}),
  };
}

export function resolvePaymentReceipt(
  response: Response,
): PaymentReceipt | null {
  const paymentReceiptHeader = response.headers.get("Payment-Receipt");
  return paymentReceiptHeader
    ? parsePaymentReceiptHeader(paymentReceiptHeader)
    : null;
}

function getTempoClient(parameters: { chainId?: number }) {
  const chainId = parameters.chainId ?? NETWORK.TEMPO.CHAIN_ID;
  if (chainId !== NETWORK.TEMPO.CHAIN_ID) {
    throw new Error(`Unsupported Tempo chain: ${chainId}`);
  }

  return createClient({
    chain: {
      ...tempoChain,
      id: chainId,
      name: NETWORK.TEMPO.NAME,
      rpcUrls: {
        default: { http: [TEMPO_RPC_URL] },
        public: { http: [TEMPO_RPC_URL] },
      },
    },
    transport: http(TEMPO_RPC_URL, {
      fetchFn: ipv4Fetch,
    }),
  });
}

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/**
 * Reads the on-chain PATH_USD (USDC) balance for a given wallet address on Tempo.
 * Returns the balance in cents (integer).
 */
export async function getOnChainBalance(
  walletAddress: string,
): Promise<{ balanceCents: number; balanceFormatted: string }> {
  const publicClient = createPublicClient({
    chain: {
      ...tempoChain,
      id: NETWORK.TEMPO.CHAIN_ID,
      name: NETWORK.TEMPO.NAME,
      rpcUrls: {
        default: { http: [TEMPO_RPC_URL] },
        public: { http: [TEMPO_RPC_URL] },
      },
    },
    transport: http(TEMPO_RPC_URL, { fetchFn: ipv4Fetch }),
  });

  const contract = NETWORK.TEMPO.PATH_USD_CONTRACT as `0x${string}`;
  const address = walletAddress as `0x${string}`;

  const rawBalance = await publicClient.readContract({
    address: contract,
    abi: ERC20_BALANCE_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  // PATH_USD has 6 decimals — convert to cents (×100 / 1e6 = /1e4)
  const decimals = NETWORK.TEMPO.PATH_USD_DECIMALS; // 6
  const divisorToCents = BigInt(10 ** (decimals - 2)); // 1e4
  const balanceCents = Number(rawBalance / divisorToCents);
  const balanceFormatted = formatUsd(balanceCents);

  return { balanceCents, balanceFormatted };
}

/**
 * On-chain balance with a hard timeout so a hung/slow RPC node can never block
 * a request (wallet page, pre-flight checks). Rejects after `timeoutMs`.
 */
export async function getOnChainBalanceWithTimeout(
  walletAddress: string,
  timeoutMs = 7_000,
): Promise<{ balanceCents: number; balanceFormatted: string }> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Balance check timed out")),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([getOnChainBalance(walletAddress), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function buildMppClientConfig(
  creatorId: string,
  walletId: string,
  address: `0x${string}`,
) {
  const account = createPrivyAccount(walletId, address);
  return {
    account,
    clientConfig: {
      onChallenge: async (
        challenge: MppPaymentChallenge,
        helpers: MppChallengeHelpers,
      ) => {
        const quotedAmountCents = extractQuotedAmountCents(challenge);
        if (quotedAmountCents === null) {
          throw new Error("Unable to determine quoted payment amount");
        }

        await enforcePerTransactionLimit(creatorId, quotedAmountCents);
        await enforceCumulativeLimits(creatorId, quotedAmountCents);
        return helpers.createCredential();
      },
      methods: [tempo({ account, getClient: getTempoClient })],
    },
  } as const;
}

export async function createMppClient(
  creatorId: string,
  walletId: string,
  address: `0x${string}`,
) {
  const config = await buildMppClientConfig(creatorId, walletId, address);

  return {
    account: config.account,
    async fetch(url: string, options?: RequestInit): Promise<Response> {
      log.info({ creatorId, url }, "MPP fetch");
      const serviceUrl = new URL(url);
      const attempt = await createPaymentAttempt({
        creator_id: creatorId,
        service_url: url,
        service_host: serviceUrl.hostname,
        status: "started",
        metadata: {
          requestMethod: options?.method ?? "GET",
        },
      });

      let quotedAmountCents: number | null = null;

      try {
        await checkSpendingLimits(creatorId);
      } catch (error) {
        await updatePaymentAttempt(attempt.id, {
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : "Spending limit check failed",
        });
        throw error;
      }

      const mppx = Mppx.create({
        ...config.clientConfig,
        onChallenge: async (
          challenge: MppPaymentChallenge,
          helpers: MppChallengeHelpers,
        ) => {
          quotedAmountCents = extractQuotedAmountCents(challenge);
          if (quotedAmountCents === null) {
            await updatePaymentAttempt(attempt.id, {
              status: "failed",
              method: challenge.method ?? null,
              intent: (challenge as { intent?: string }).intent ?? null,
              currency:
                typeof challenge.request?.currency === "string"
                  ? challenge.request.currency
                  : null,
              challenge_id: (challenge as { id?: string }).id ?? null,
              error: "Unable to determine quoted payment amount",
              metadata: { challenge: toJsonValue(challenge) },
            });
            throw new Error("Unable to determine quoted payment amount");
          }

          await updatePaymentAttempt(attempt.id, {
            status: "challenge_created",
            method: challenge.method,
            intent: (challenge as { intent?: string }).intent ?? null,
            currency:
              typeof challenge.request?.currency === "string"
                ? challenge.request.currency
                : null,
            quoted_amount_cents: quotedAmountCents,
            challenge_id: (challenge as { id?: string }).id ?? null,
            metadata: { challenge: toJsonValue(challenge) },
          });

          try {
            await enforcePerTransactionLimit(creatorId, quotedAmountCents);
            await enforceCumulativeLimits(creatorId, quotedAmountCents);
          } catch (error) {
            await updatePaymentAttempt(attempt.id, {
              status: "failed",
              error:
                error instanceof Error
                  ? error.message
                  : "Spending limit exceeded",
            });
            throw error;
          }

          const credential = await helpers.createCredential();
          await updatePaymentAttempt(attempt.id, {
            status: "credential_created",
          });
          return credential;
        },
        polyfill: false,
      });

      try {
        const response = await mppx.fetch(url, options);

        const paymentReceipt = resolvePaymentReceipt(response);
        if (paymentReceipt) {
          const receiptAmountCents =
            paymentReceipt.amount && paymentReceipt.currency
              ? extractTempoAmountCents(
                  paymentReceipt.amount,
                  paymentReceipt.currency,
                )
              : null;
          const actualAmountCents = receiptAmountCents ?? quotedAmountCents;
          const transaction = await logTransaction({
            creator_id: creatorId,
            type: "mpp_payment",
            amount_cents: actualAmountCents ?? 0,
            description: `MPP payment to ${serviceUrl.hostname}`,
            service: serviceUrl.hostname,
            tx_hash: paymentReceipt.reference,
            metadata: {
              receipt: toJsonValue(paymentReceipt),
              quotedAmountCents,
              receiptAmountCents,
            },
          });
          await updatePaymentAttempt(attempt.id, {
            status: "succeeded",
            actual_amount_cents: actualAmountCents,
            receipt_reference: paymentReceipt.reference,
            tx_hash: paymentReceipt.reference,
            transaction_id: transaction.id,
            metadata: {
              receipt: toJsonValue(paymentReceipt),
              quotedAmountCents,
              receiptAmountCents,
            },
          });
          log.info(
            {
              creatorId,
              amountCents: actualAmountCents,
              tx: paymentReceipt.reference,
            },
            "MPP payment",
          );
        } else if (!response.ok) {
          await updatePaymentAttempt(attempt.id, {
            status: "failed",
            error: `MPP request failed with HTTP ${response.status}`,
          });
        } else {
          await updatePaymentAttempt(attempt.id, {
            status: "succeeded",
            actual_amount_cents: 0,
            metadata: {
              responseStatus: response.status,
              quotedAmountCents,
              note: "No Payment-Receipt header was returned.",
            },
          });
        }

        return response;
      } catch (error) {
        await updatePaymentAttempt(attempt.id, {
          status: "failed",
          error: error instanceof Error ? error.message : "MPP request failed",
        });
        throw error;
      }
    },
  };
}

export async function installMppFetchPolyfill(
  creatorId: string,
  walletId: string,
  address: `0x${string}`,
) {
  const config = await buildMppClientConfig(creatorId, walletId, address);
  const mppx = Mppx.create({
    ...config.clientConfig,
    polyfill: true,
  });

  return {
    account: config.account,
    rawFetch: mppx.rawFetch,
    restore() {
      Mppx.restore();
    },
  };
}
