import { describe, it, expect } from "vitest";
import {
  buildAgentWalletCreateParams,
  buildAgentWalletPolicyDefinition,
  buildPrivyLinkedAccountInput,
  findEmbeddedEthereumWallet,
} from "../../../src/wallet/privy-provisioning.js";

describe("buildPrivyLinkedAccountInput", () => {
  it("uses Telegram when the creator has a telegram id", () => {
    const linkedAccount = buildPrivyLinkedAccountInput({
      id: "creator-1",
      telegram_chat_id: "12345",
      whatsapp_phone: null,
      display_name: "Ada Creator",
    });

    expect(linkedAccount).toEqual({
      type: "telegram",
      telegram_user_id: "12345",
      first_name: "Ada Creator",
    });
  });

  it("falls back to custom auth when no telegram id exists", () => {
    const linkedAccount = buildPrivyLinkedAccountInput({
      id: "creator-2",
      telegram_chat_id: null,
      whatsapp_phone: "+2348000000000",
      display_name: "Bola Creator",
    });

    expect(linkedAccount).toEqual({
      type: "custom_auth",
      custom_user_id: "creator-2",
    });
  });
});

describe("findEmbeddedEthereumWallet", () => {
  it("returns the embedded ethereum wallet with an id", () => {
    const wallet = findEmbeddedEthereumWallet([
      {
        type: "wallet",
        chain_type: "ethereum",
        connector_type: "embedded",
        wallet_client: "privy",
        wallet_client_type: "privy",
        id: "wallet_123",
        address: "0x123",
      },
      {
        type: "wallet",
        chain_type: "solana",
        connector_type: "embedded",
        wallet_client: "privy",
        wallet_client_type: "privy",
        id: "wallet_sol",
        address: "So111",
      },
    ]);

    expect(wallet).toEqual({
      walletId: "wallet_123",
      address: "0x123",
    });
  });

  it("returns null when no embedded ethereum wallet exists", () => {
    const wallet = findEmbeddedEthereumWallet([
      {
        type: "wallet",
        chain_type: "ethereum",
        connector_type: "injected",
        wallet_client: "unknown",
        wallet_client_type: "metamask",
        id: null,
        address: "0x456",
      },
    ]);

    expect(wallet).toBeNull();
  });
});

describe("buildAgentWalletPolicyDefinition", () => {
  it("creates a Tempo-only policy with zero native token transfer allowance", () => {
    const policy = buildAgentWalletPolicyDefinition("creator-1");

    expect(policy).toMatchObject({
      version: "1.0",
      chain_type: "ethereum",
    });
    expect(policy.name).toMatch(/^Indyfren agent [a-f0-9]{12}$/);
    expect(policy.name.length).toBeLessThan(50);
    expect(policy.rules).toHaveLength(2);
    expect(policy.rules[0]).toEqual({
      name: "Tempo chain only",
      method: "eth_sendTransaction",
      action: "ALLOW",
      conditions: [
        {
          field_source: "ethereum_transaction",
          field: "chain_id",
          operator: "eq",
          value: "42431",
        },
      ],
    });
    expect(policy.rules[1]).toEqual({
      name: "No native token transfers",
      method: "eth_sendTransaction",
      action: "ALLOW",
      conditions: [
        {
          field_source: "ethereum_transaction",
          field: "chain_id",
          operator: "eq",
          value: "42431",
        },
        {
          field_source: "ethereum_transaction",
          field: "value",
          operator: "eq",
          value: "0",
        },
      ],
    });
  });

  it("keeps the policy name under Privy's 50 character limit for long creator ids", () => {
    const policy = buildAgentWalletPolicyDefinition(
      "201d129d-e8af-4a59-b003-33a524e02f9c"
    );

    expect(policy.name).toMatch(/^Indyfren agent [a-f0-9]{12}$/);
    expect(policy.name.length).toBeLessThan(50);
  });
});

describe("buildAgentWalletCreateParams", () => {
  it("attaches the generated policy to agent wallet creation", () => {
    expect(buildAgentWalletCreateParams("policy_123")).toEqual({
      chain_type: "ethereum",
      policy_ids: ["policy_123"],
    });
  });
});
