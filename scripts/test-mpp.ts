import { pathToFileURL } from "node:url";

export function isUnfundedTempoWalletError(message: string): boolean {
  return /insufficient\s*balance|insufficientbalance/i.test(message);
}

export function resolveMppSmokeExitCode(
  message: string,
  options: { allowUnfundedWallet?: boolean } = {},
): number {
  if (options.allowUnfundedWallet && isUnfundedTempoWalletError(message)) {
    return 0;
  }

  return 1;
}

function readBooleanEnv(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

async function resolveCreatorId(): Promise<string> {
  const configured = process.env.MPP_TEST_CREATOR_ID?.trim();
  if (configured) {
    return configured;
  }

  const { supabase } = await import("../src/db/client.js");
  const { data, error } = await supabase
    .from("creators")
    .select("id, privy_user_id, wallet_id")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(
      `Unable to load a creator for smoke test: ${error.message}`,
    );
  }

  const preferred =
    data?.find((creator) => creator.privy_user_id) ??
    data?.find(
      (creator) => !(creator.wallet_id ?? "").startsWith("test-wallet-"),
    ) ??
    data?.[0];

  if (!preferred?.id) {
    throw new Error(
      "No creator found for MPP smoke test. Set MPP_TEST_CREATOR_ID or seed a creator first.",
    );
  }

  return preferred.id;
}

async function testMpp() {
  console.log("Testing MPP client polyfill against the official paid ping...");

  try {
    const { createWalletForCreator } = await import("../src/wallet/privy.js");
    const { installMppFetchPolyfill } = await import("../src/wallet/mpp.js");
    const creatorId = await resolveCreatorId();
    console.log(`Using creator: ${creatorId}`);

    const wallet = await createWalletForCreator(creatorId);
    console.log(`Wallet created: ${wallet.address}`);

    const polyfillClient = await installMppFetchPolyfill(
      creatorId,
      wallet.walletId,
      wallet.address as `0x${string}`,
    );

    try {
      const response = await fetch("https://mpp.dev/api/ping/paid");
      const body = await response.text();
      console.log(`MPP fetch status: ${response.status}`);
      console.log(`Response: ${body}`);
      if (!response.ok) {
        throw new Error(
          `MPP paid ping returned HTTP ${response.status}: ${body}`,
        );
      }
    } finally {
      polyfillClient.restore();
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error while testing MPP";

    console.error(`MPP test failed: ${message}`);
    if (isUnfundedTempoWalletError(message)) {
      console.log(
        "The creator wallet is provisioned, but it needs pathUSD on Tempo testnet before paid requests can succeed.",
      );
      if (readBooleanEnv(process.env.MPP_SMOKE_ALLOW_UNFUNDED)) {
        console.log(
          "WARN  MPP_SMOKE_ALLOW_UNFUNDED=true is set, so this sandbox funding failure is non-blocking.",
        );
      }
    } else {
      console.log(
        "This is expected if Supabase, Privy, or external network access are not configured.",
      );
    }
    process.exitCode = resolveMppSmokeExitCode(message, {
      allowUnfundedWallet: readBooleanEnv(process.env.MPP_SMOKE_ALLOW_UNFUNDED),
    });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  testMpp().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
