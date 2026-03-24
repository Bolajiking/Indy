import { createPrivyAccount } from "./privy.js";
import { logTransaction } from "../db/queries/transactions.js";
import {
  checkSpendingLimits,
  enforcePerTransactionLimit,
  extractQuotedAmountCents,
} from "./spending.js";
import { Mppx, tempo } from "mppx/client";
import pino from "pino";
import { createClient, http, createPublicClient } from "viem";
import { tempo as tempoChain } from "viem/chains";
import { NETWORK } from "../config/constants.js";
import { ipv4Fetch } from "../network/ipv4-fetch.js";

const log = pino({ name: "wallet:mpp" });
const TEMPO_RPC_URL = "https://rpc.moderato.tempo.xyz";

type MppPaymentChallenge = Parameters<typeof extractQuotedAmountCents>[0];
type MppChallengeHelpers = {
  createCredential: () => Promise<string>;
};

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
export async function getOnChainBalance(walletAddress: string): Promise<{ balanceCents: number; balanceFormatted: string }> {
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
  const balanceFormatted = `$${(balanceCents / 100).toFixed(2)}`;

  return { balanceCents, balanceFormatted };
}

async function buildMppClientConfig(
  creatorId: string,
  walletId: string,
  address: `0x${string}`
) {
  const account = createPrivyAccount(walletId, address);
  return {
    account,
    clientConfig: {
      onChallenge: async (
        challenge: MppPaymentChallenge,
        helpers: MppChallengeHelpers
      ) => {
        const quotedAmountCents = extractQuotedAmountCents(challenge);
        if (quotedAmountCents === null) {
          throw new Error("Unable to determine quoted payment amount");
        }

        await enforcePerTransactionLimit(creatorId, quotedAmountCents);
        return helpers.createCredential();
      },
      methods: [tempo({ account, getClient: getTempoClient })],
    },
  } as const;
}

export async function createMppClient(
  creatorId: string,
  walletId: string,
  address: `0x${string}`
) {
  const config = await buildMppClientConfig(creatorId, walletId, address);
  const mppx = Mppx.create({
    ...config.clientConfig,
    polyfill: false,
  });

  return {
    account: config.account,
    async fetch(url: string, options?: RequestInit): Promise<Response> {
      log.info({ creatorId, url }, "MPP fetch");
      await checkSpendingLimits(creatorId);

      const response = await mppx.fetch(url, options);

      const paymentHeader = response.headers.get("payment-response");
      if (paymentHeader) {
        const parsed = JSON.parse(paymentHeader);
        await logTransaction({
          creator_id: creatorId,
          type: "mpp_payment",
          amount_cents: Math.round(parsed.amount * 100),
          description: `MPP payment to ${new URL(url).hostname}`,
          service: new URL(url).hostname,
          tx_hash: parsed.txHash,
          metadata: { paymentResponse: parsed },
        });
        log.info({ creatorId, amount: parsed.amount, tx: parsed.txHash }, "MPP payment");
      }

      return response;
    },
  };
}

export async function installMppFetchPolyfill(
  creatorId: string,
  walletId: string,
  address: `0x${string}`
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
