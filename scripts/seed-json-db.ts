import { resetDb } from "../lib/server/data-store";

async function main() {
  const dbFile = await resetDb();
  console.log(`KasirKita local/cloud JSON database reset: ${dbFile}`);
  console.log("Owner login: ownerkasirkita / Regina050322");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
