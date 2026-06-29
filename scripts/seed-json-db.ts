import { resetDb } from "../lib/server/data-store";

async function main() {
  const dbFile = await resetDb();
  console.log(`KasirKita local/cloud JSON database reset: ${dbFile}`);
  console.log("Owner login: ***REMOVED-FROM-HISTORY*** / ***REMOVED-FROM-HISTORY***");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
