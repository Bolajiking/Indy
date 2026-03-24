import { PrivyClient } from "@privy-io/node";
import { keccak256 } from "viem";
import { toAccount } from "viem/accounts";
import { env } from "../config/env.js";
import { updateCreator } from "../db/queries/creators.js";
import { supabase } from "../db/client.js";
import pino from "pino";
import { ipv4Fetch } from "../network/ipv4-fetch.js";
import {
  buildAgentWalletCreateParams,
  buildAgentWalletPolicyDefinition,
  type ProvisioningCreatorIdentity,
} from "./privy-provisioning.js";

const log = pino({ name: "wallet:privy" });

const privy = new PrivyClient({
  appId: env.PRIVY_APP_ID,
  appSecret: env.PRIVY_APP_SECRET,
  jwtVerificationKey: env.PRIVY_JWT_VERIFICATION_KEY || undefined,
  fetch: ipv4Fetch,
});

interface ProvisioningCreatorRecord extends ProvisioningCreatorIdentity {
  wallet_id: string | null;
  wallet_address: string | null;
  settings: Record<string, unknown> | null;
}

interface ResolvedWallet {
  walletId: string;
  address: string;
}

async function getProvisioningCreator(
  creatorId: string
): Promise<ProvisioningCreatorRecord> {
  const { data, error } = await supabase
    .from("creators")
    .select("id, telegram_chat_id, whatsapp_phone, display_name, wallet_id, wallet_address, settings")
    .eq("id", creatorId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function isInvalidStoredWalletError(error: unknown): boolean {
  const candidate = error as {
    status?: number;
    error?: { code?: string };
  };

  return (
    candidate?.status === 404 ||
    candidate?.status === 400 ||
    candidate?.error?.code === "invalid_data"
  );
}

async function validateStoredWalletReference(parameters: {
  creatorId: string;
  walletId: string;
  walletAddress: string;
}): Promise<ResolvedWallet | null> {
  try {
    const wallet = await privy.wallets().get(parameters.walletId);
    if (!wallet.address) {
      log.warn(
        { creatorId: parameters.creatorId, walletId: parameters.walletId },
        "Stored Privy wallet is missing an address"
      );
      return null;
    }

    const storedAddress = parameters.walletAddress.toLowerCase();
    const canonicalAddress = wallet.address.toLowerCase();

    if (storedAddress !== canonicalAddress) {
      log.warn(
        {
          creatorId: parameters.creatorId,
          walletId: parameters.walletId,
          storedAddress: parameters.walletAddress,
          canonicalAddress: wallet.address,
        },
        "Stored wallet address did not match Privy wallet address"
      );
      return {
        walletId: parameters.walletId,
        address: wallet.address,
      };
    }

    return {
      walletId: parameters.walletId,
      address: parameters.walletAddress,
    };
  } catch (error) {
    if (isInvalidStoredWalletError(error)) {
      log.warn(
        { creatorId: parameters.creatorId, walletId: parameters.walletId, error },
        "Stored Privy wallet reference is invalid"
      );
      return null;
    }

    throw error;
  }
}

async function ensureAgentWalletPolicy(
  creator: ProvisioningCreatorRecord
): Promise<string> {
  const settings = creator.settings ?? {};
  const persistedPolicyId =
    typeof settings.privy_policy_id === "string" ? settings.privy_policy_id : null;

  if (persistedPolicyId) {
    try {
      await privy.policies().get(persistedPolicyId);
      return persistedPolicyId;
    } catch (error) {
      log.warn(
        { creatorId: creator.id, privyPolicyId: persistedPolicyId, error },
        "Stored Privy policy lookup failed"
      );
    }
  }

  const policy = await privy.policies().create({
    ...buildAgentWalletPolicyDefinition(creator.id),
  });

  return policy.id;
}

export async function createWalletForCreator(creatorId: string) {
  const creator = await getProvisioningCreator(creatorId);

  if (creator.wallet_id && creator.wallet_address) {
    const storedWallet = await validateStoredWalletReference({
      creatorId,
      walletId: creator.wallet_id,
      walletAddress: creator.wallet_address,
    });

    if (storedWallet) {
      if (storedWallet.address !== creator.wallet_address) {
        await updateCreator(creatorId, {
          wallet_address: storedWallet.address,
        });
      }

      return storedWallet;
    }
  }

  log.info({ creatorId }, "Provisioning policy-backed Privy agent wallet");

  const policyId = await ensureAgentWalletPolicy(creator);
  const wallet = await privy
    .wallets()
    .create(buildAgentWalletCreateParams(policyId));

  await updateCreator(creatorId, {
    wallet_id: wallet.id,
    wallet_address: wallet.address,
    settings: {
      ...(creator.settings ?? {}),
      privy_policy_id: policyId,
      wallet_mode: "agentic",
    },
  });
  log.info({ creatorId, address: wallet.address, policyId }, "Wallet provisioned");
  return {
    walletId: wallet.id,
    address: wallet.address,
  };
}

export async function resolveWalletForCreator(
  creatorId: string,
  walletId?: string | null,
  walletAddress?: string | null
): Promise<ResolvedWallet | null> {
  if (!walletId || !walletAddress) {
    return null;
  }

  const storedWallet = await validateStoredWalletReference({
    creatorId,
    walletId,
    walletAddress,
  });

  if (storedWallet) {
    return storedWallet;
  }

  return createWalletForCreator(creatorId);
}

export function createPrivyAccount(walletId: string, address: `0x${string}`) {
  async function signHash(hash: `0x${string}`): Promise<`0x${string}`> {
    const result = await privy.wallets().ethereum().signSecp256k1(walletId, {
      params: { hash },
    });
    return result.signature as `0x${string}`;
  }

  return toAccount({
    address,
    async signMessage({ message }) {
      const result = await privy.wallets().ethereum().signMessage(walletId, {
        message: typeof message === "string" ? message : message.raw,
      });
      return result.signature as `0x${string}`;
    },
    async signTransaction(transaction, options) {
      const serializer = options?.serializer;
      if (!serializer) {
        throw new Error("Tempo serializer required");
      }

      const unsignedSerialized = await serializer(transaction);
      const hash = keccak256(unsignedSerialized);
      const signature = await signHash(hash as `0x${string}`);
      const { SignatureEnvelope } = await import("ox/tempo");
      const envelope = SignatureEnvelope.from(signature);
      return (await serializer(transaction, envelope as never)) as `0x${string}`;
    },
    async signTypedData(typedData) {
      const result = await privy.wallets().ethereum().signTypedData(walletId, {
        params: typedData as never,
      });
      return result.signature as `0x${string}`;
    },
  });
}

export { privy };
