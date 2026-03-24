import { Hono } from "hono";
import { getTransactionsForCreator } from "../../db/queries/transactions.js";
import { getCreatorById } from "../../db/queries/creators.js";
import { getAuthContext, requireCreatorAuth } from "../middleware/auth.js";
import { getOnChainBalance } from "../../wallet/mpp.js";
import pino from "pino";

const log = pino({ name: "api:wallet" });

export const wallet = new Hono();

wallet.use("*", requireCreatorAuth);

wallet.get("/transactions", async (context) => {
  const { creatorId } = getAuthContext(context);
  const rawLimit = Number(context.req.query("limit") ?? 50);
  // Clamp: must be a positive integer, max 200
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 200) : 50;
  const transactions = await getTransactionsForCreator(creatorId!, limit);
  return context.json(transactions);
});

wallet.get("/balance", async (context) => {
  const { creatorId } = getAuthContext(context);
  const creator = await getCreatorById(creatorId!);

  if (!creator?.wallet_address) {
    return context.json({ balanceCents: 0, balanceFormatted: "$0.00", walletAddress: null, error: "Wallet not yet provisioned" });
  }

  try {
    const { balanceCents, balanceFormatted } = await getOnChainBalance(creator.wallet_address);
    return context.json({ balanceCents, balanceFormatted, walletAddress: creator.wallet_address });
  } catch (err) {
    log.error({ err, creatorId, walletAddress: creator.wallet_address }, "Failed to fetch on-chain balance");
    return context.json({ balanceCents: 0, balanceFormatted: "$0.00", walletAddress: creator.wallet_address, error: "Unable to fetch balance" }, 500);
  }
});
