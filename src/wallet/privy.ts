import { PrivyAPI } from "@privy-io/node";
import { toAccount } from "viem/accounts";
import { keccak256 } from "viem";
import { env } from "../config/env.js";
import { updateCreator } from "../db/queries/creators.js";
import pino from "pino";

const log = pino({ name: "wallet:privy" });

const privy = new PrivyAPI({
  appID: env.PRIVY_APP_ID,
  appSecret: env.PRIVY_APP_SECRET,
});

export async function createWalletForCreator(creatorId: string) {
  log.info({ creatorId }, "Creating wallet");
  const wallet = await privy.wallets.create({ chain_type: "ethereum" });
  await updateCreator(creatorId, {
    wallet_id: wallet.id,
    wallet_address: wallet.address,
  });
  log.info({ creatorId, address: wallet.address }, "Wallet created");
  return { walletId: wallet.id, address: wallet.address };
}

export function createPrivyAccount(walletId: string, address: `0x${string}`) {
  return toAccount({
    address,
    async signMessage({ message }) {
      const messageStr = typeof message === "string" ? message : message.raw;
      const result = await privy.wallets._rpc(walletId, {
        method: "personal_sign",
        params: {
          encoding: typeof message === "string" ? "utf-8" : "hex",
          message: typeof messageStr === "string" ? messageStr : (messageStr as Uint8Array).toString(),
        },
        chain_type: "ethereum",
      });
      if (result.method !== "personal_sign") {
        throw new Error("Unexpected RPC method response");
      }
      return result.data.signature as `0x${string}`;
    },
    async signTransaction(transaction, options) {
      const serializer = options?.serializer;
      if (!serializer) throw new Error("Serializer required for Tempo transactions");
      const unsignedSerialized = await serializer(transaction);
      const hash = keccak256(unsignedSerialized);
      const result = await privy.wallets._rawSign(walletId, {
        params: { hash },
      });
      return result.signature as `0x${string}`;
    },
    async signTypedData(typedData) {
      const result = await privy.wallets._rpc(walletId, {
        method: "eth_signTypedData_v4",
        params: { typed_data: typedData },
        chain_type: "ethereum",
      });
      if (result.method !== "eth_signTypedData_v4") {
        throw new Error("Unexpected RPC method response");
      }
      return result.data.signature as `0x${string}`;
    },
  });
}

export { privy };
