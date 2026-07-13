import { resetDb } from "../lib/server/data-store";

async function main() {
  const dbFile = await resetDb();
  console.log(`KasirKita local/cloud JSON database reset: ${dbFile}`);
  if (process.env.KASIRKITA_BOOTSTRAP_OWNER_USERNAME) {
    console.log("Owner bootstrap created from environment variables. Remove the bootstrap variables after the first successful login.");
  } else {
    console.log("No Owner was created. Set the KASIRKITA_BOOTSTRAP_OWNER_* variables before resetting an empty database.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
