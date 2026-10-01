/**
 * pnpm photos:cleanup           → dry run: shows what would be trimmed and deleted, changes nothing
 * pnpm photos:cleanup --apply   → actually trim old listings and delete unreferenced photos
 * pnpm photos:cleanup --apply --force → skip the "more than half the bucket" safety stop
 */
import { cleanupPhotos } from "../lib/server/services/photo-cleanup";

async function main() {
  const args = process.argv.slice(2);
  const result = await cleanupPhotos({ dryRun: !args.includes("--apply"), force: args.includes("--force") });
  console.table(result);
  if (result.dryRun) console.log("Dry run — nothing changed. Rerun with --apply to clean up.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
