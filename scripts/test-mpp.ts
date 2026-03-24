import { supabase } from "../src/db/client.js";
import { createWalletForCreator } from "../src/wallet/privy.js";
import { installMppFetchPolyfill } from "../src/wallet/mpp.js";

async function resolveCreatorId(): Promise<string> {
  const configured = process.env.MPP_TEST_CREATOR_ID?.trim();
  if (configured) {
    return configured;
  }

  const { data, error } = await supabase
    .from("creators")
    .select("id, privy_user_id, wallet_id")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Unable to load a creator for smoke test: ${error.message}`);
  }

  const preferred =
    data?.find((creator) => creator.privy_user_id) ??
    data?.find((creator) => !(creator.wallet_id ?? "").startsWith("test-wallet-")) ??
    data?.[0];

  if (!preferred?.id) {
    throw new Error(
      "No creator found for MPP smoke test. Set MPP_TEST_CREATOR_ID or seed a creator first."
    );
  }

  return preferred.id;
}

async function testMpp() {
  console.log("Testing MPP client polyfill against the official paid ping...");

  try {
    const creatorId = await resolveCreatorId();
    console.log(`Using creator: ${creatorId}`);

    const wallet = await createWalletForCreator(creatorId);
    console.log(`Wallet created: ${wallet.address}`);

    const polyfillClient = await installMppFetchPolyfill(
      creatorId,
      wallet.walletId,
      wallet.address as `0x${string}`
    );

    try {
      const response = await fetch("https://mpp.dev/api/ping/paid");
      console.log(`MPP fetch status: ${response.status}`);
      console.log(`Response: ${await response.text()}`);
    } finally {
      polyfillClient.restore();
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error while testing MPP";

    console.error(`MPP test failed: ${message}`);
    if (message.includes("InsufficientBalance")) {
      console.log(
        "The creator wallet is provisioned, but it needs pathUSD on Tempo testnet before paid requests can succeed."
      );
      return;
    }
    console.log(
      "This is expected if Supabase, Privy, or external network access are not configured."
    );
  }
}

testMpp().catch((error) => {
  console.error(error);
  process.exit(1);
});
