import { Hono } from "hono";
import { getTransactionsForCreator } from "../../db/queries/transactions.js";
import { getPaymentAttemptsForCreator } from "../../db/queries/payment-attempts.js";
import { getCreatorById } from "../../db/queries/creators.js";
import { getAuthContext, requireCreatorAuth } from "../middleware/auth.js";
import { getOnChainBalanceWithTimeout } from "../../wallet/mpp.js";
import { AGENT, NETWORK } from "../../config/constants.js";
import { resolveCreatorSpendingLimits } from "../../wallet/spending.js";
import pino from "pino";
import type {
  ApiPaymentAttempt,
  ApiTransaction,
  ApiWalletBalance,
} from "../contracts.js";

const log = pino({ name: "api:wallet" });

export const wallet = new Hono();

wallet.use("*", requireCreatorAuth);

wallet.get("/transactions", async (context) => {
  const { creatorId } = getAuthContext(context);
  const rawLimit = Number(context.req.query("limit") ?? 50);
  // Clamp: must be a positive integer, max 200
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 200)
      : 50;
  const transactions = await getTransactionsForCreator(creatorId!, limit);
  return context.json(transactions satisfies ApiTransaction[]);
});

wallet.get("/payment-attempts", async (context) => {
  const { creatorId } = getAuthContext(context);
  const rawLimit = Number(context.req.query("limit") ?? 50);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), 200)
      : 50;
  const attempts = await getPaymentAttemptsForCreator(creatorId!, limit);
  return context.json(attempts satisfies ApiPaymentAttempt[]);
});

wallet.get("/balance", async (context) => {
  const { creatorId } = getAuthContext(context);
  const creator = await getCreatorById(creatorId!);

  if (!creator?.wallet_address) {
    return context.json({
      balanceCents: 0,
      balanceFormatted: "$0.00",
      walletAddress: null,
      error: "Wallet not yet provisioned",
    } satisfies ApiWalletBalance);
  }

  try {
    const { balanceCents, balanceFormatted } =
      await getOnChainBalanceWithTimeout(creator.wallet_address);
    const spendingLimits = resolveCreatorSpendingLimits(creator);
    return context.json({
      balanceCents,
      balanceFormatted,
      walletAddress: creator.wallet_address,
      fundingMode: "tempo_testnet_faucet",
      lowBalance: balanceCents < AGENT.MIN_TASK_COST_CENTS,
      minimumRecommendedBalanceCents: AGENT.MIN_TASK_COST_CENTS,
      spendingLimits,
      network: {
        name: NETWORK.TEMPO.NAME,
        chainId: NETWORK.TEMPO.CHAIN_ID,
        rpcUrl: "https://rpc.moderato.tempo.xyz",
        currency: "pathUSD",
        tokenAddress: NETWORK.TEMPO.PATH_USD_CONTRACT,
        tokenDecimals: NETWORK.TEMPO.PATH_USD_DECIMALS,
      },
      fundingInstructions: {
        title: "Tempo testnet sandbox funding",
        description:
          "Use the Tempo testnet faucet for sandbox pathUSD. Do not treat this as production money.",
        faucetRpcMethod: "tempo_fundAddress",
      },
    } satisfies ApiWalletBalance);
  } catch (err) {
    log.error(
      { err, creatorId, walletAddress: creator.wallet_address },
      "Failed to fetch on-chain balance",
    );
    return context.json(
      {
        balanceCents: 0,
        balanceFormatted: "$0.00",
        walletAddress: creator.wallet_address,
        error: "Unable to fetch balance",
      } satisfies ApiWalletBalance,
      500,
    );
  }
});
