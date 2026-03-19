import { createPrivyAccount } from "./privy.js";
import { logTransaction } from "../db/queries/transactions.js";
import { checkSpendingLimits } from "./spending.js";
import pino from "pino";

const log = pino({ name: "wallet:mpp" });

export async function createMppClient(
  creatorId: string,
  walletId: string,
  address: `0x${string}`
) {
  const account = createPrivyAccount(walletId, address);

  return {
    async fetch(url: string, options?: RequestInit): Promise<Response> {
      log.info({ creatorId, url }, "MPP fetch");
      await checkSpendingLimits(creatorId);

      // Use native fetch — mppx wrapping can be added when Tempo mainnet is ready
      const response = await globalThis.fetch(url, options);

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
        });
        log.info({ creatorId, amount: parsed.amount, tx: parsed.txHash }, "MPP payment");
      }

      return response;
    },
  };
}
