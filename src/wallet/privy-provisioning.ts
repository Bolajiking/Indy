import { createHash } from "node:crypto";
import { NETWORK } from "../config/constants.js";

export interface ProvisioningCreatorIdentity {
  id: string;
  telegram_chat_id: string | null;
  whatsapp_phone: string | null;
  display_name: string;
}

export interface AgentWalletPolicyDefinition {
  version: "1.0";
  name: string;
  chain_type: "ethereum";
  rules: Array<{
    name: string;
    method: "eth_sendTransaction";
    action: "ALLOW";
    conditions: Array<{
      field: "chain_id" | "value";
      field_source: "ethereum_transaction";
      operator: "eq";
      value: string;
    }>;
  }>;
}

export type PrivyLinkedAccountInput =
  | {
      type: "telegram";
      telegram_user_id: string;
      first_name?: string;
    }
  | {
      type: "custom_auth";
      custom_user_id: string;
    };

export interface PrivyLinkedAccountLike {
  type?: string;
  chain_type?: string;
  connector_type?: string;
  wallet_client?: string;
  wallet_client_type?: string;
  id?: string | null;
  address?: string;
}

export function buildPrivyLinkedAccountInput(
  creator: ProvisioningCreatorIdentity,
): PrivyLinkedAccountInput {
  if (creator.telegram_chat_id) {
    return {
      type: "telegram",
      telegram_user_id: creator.telegram_chat_id,
      first_name: creator.display_name,
    };
  }

  return {
    type: "custom_auth",
    custom_user_id: creator.id,
  };
}

export function findEmbeddedEthereumWallet(
  linkedAccounts: PrivyLinkedAccountLike[],
): { walletId: string; address: string } | null {
  for (const account of linkedAccounts) {
    if (
      account.type === "wallet" &&
      account.chain_type === "ethereum" &&
      account.connector_type === "embedded" &&
      account.wallet_client === "privy" &&
      account.wallet_client_type === "privy" &&
      account.id &&
      account.address
    ) {
      return {
        walletId: account.id,
        address: account.address,
      };
    }
  }

  return null;
}

export function buildAgentWalletPolicyDefinition(
  creatorId: string,
): AgentWalletPolicyDefinition {
  const chainId = String(NETWORK.TEMPO.CHAIN_ID);
  const creatorToken = createHash("sha256")
    .update(creatorId)
    .digest("hex")
    .slice(0, 12);

  return {
    version: "1.0",
    name: `Indyfren agent ${creatorToken}`,
    chain_type: "ethereum",
    rules: [
      {
        name: "Tempo chain only",
        method: "eth_sendTransaction",
        action: "ALLOW",
        conditions: [
          {
            field_source: "ethereum_transaction",
            field: "chain_id",
            operator: "eq",
            value: chainId,
          },
        ],
      },
      {
        name: "No native token transfers",
        method: "eth_sendTransaction",
        action: "ALLOW",
        conditions: [
          {
            field_source: "ethereum_transaction",
            field: "chain_id",
            operator: "eq",
            value: chainId,
          },
          {
            field_source: "ethereum_transaction",
            field: "value",
            operator: "eq",
            value: "0",
          },
        ],
      },
    ],
  };
}

export function buildAgentWalletCreateParams(policyId: string): {
  chain_type: "ethereum";
  policy_ids: string[];
} {
  return {
    chain_type: "ethereum",
    policy_ids: [policyId],
  };
}
