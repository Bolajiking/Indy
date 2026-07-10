import { migrateLegacyPlatformSecrets } from "../src/security/platform-secret-migration.js";

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const afterId = argumentValue("--after-id");
  const batchSizeRaw = argumentValue("--batch-size");
  const batchSize = batchSizeRaw ? Number(batchSizeRaw) : undefined;
  const result = await migrateLegacyPlatformSecrets({
    dryRun,
    afterId,
    batchSize,
  });

  console.log("Platform credential rotation");
  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`Scanned: ${result.scanned}`);
  console.log(`Rotated: ${result.rotated}`);
  console.log(`Already current: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Complete: ${result.complete ? "yes" : "no"}`);
  if (result.nextCursor) {
    console.log(`Resume with: --after-id ${result.nextCursor}`);
  } else if (!result.complete) {
    console.log("Resume by rerunning this batch without changing its cursor.");
  }
  if (dryRun) console.log("No rows were modified.");
  if (result.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Rotation failed");
  process.exit(1);
});
