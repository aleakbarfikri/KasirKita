import { resetDb } from "../lib/server/data-store";

async function main() {
  const dbFile = await resetDb();
  console.log(`KasirKita local/cloud JSON database reset: ${dbFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
