import { migrateLegacyPlatformSecrets } from "../src/security/platform-secret-migration.js";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const result = await migrateLegacyPlatformSecrets({ dryRun });

  console.log("Platform credential migration");
  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`Scanned: ${result.scanned}`);
  console.log(`Legacy rows found: ${result.migrated}`);
  console.log(`Already encrypted: ${result.skipped}`);

  if (dryRun) {
    console.log("No rows were modified.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
