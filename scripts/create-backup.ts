import "dotenv/config";

import { createBackup } from "../lib/server/data-store";

async function main() {
  const reason = process.argv[2] || "cli-manual";
  const backup = await createBackup(reason);
  console.log(`Backup dibuat: ${backup.id}`);
  console.log(`Ukuran: ${(backup.sizeBytes / 1024).toFixed(1)} KB`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
