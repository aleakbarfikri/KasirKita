import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { projectNormalizedRows } from "../lib/server/normalized-projection";
import type { AppDb } from "../lib/server/data-store";

async function main() {
  const databaseUrl = String(process.env.POSTGRES_URL || process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) throw new Error("POSTGRES_URL atau DATABASE_URL wajib diisi.");
  if (process.env.CONFIRM_NORMALIZED_MIGRATION !== "yes") {
    throw new Error("Set CONFIRM_NORMALIZED_MIGRATION=yes setelah backup database dibuat.");
  }

  const sql = postgres(databaseUrl, { max: 1, ssl: databaseUrl.includes("localhost") ? false : "require" });
  try {
    const schema = fs.readFileSync(path.join(process.cwd(), "database", "normalized-schema.sql"), "utf8");
    await sql.unsafe(schema);
    const stateRows = await sql<{ data: AppDb }[]>`SELECT data FROM app_state WHERE id = 'main' LIMIT 1`;
    if (!stateRows[0]?.data) throw new Error("Data app_state utama tidak ditemukan.");
    const rows = projectNormalizedRows(stateRows[0].data);
    await sql.begin(async (transaction) => {
      await transaction`TRUNCATE TABLE kasirkita_entities_v1`;
      for (const row of rows) {
        await transaction`
          INSERT INTO kasirkita_entities_v1 (entity_type, entity_id, shop_id, owner_id, admin_id, payload)
          VALUES (${row.entityType}, ${row.entityId}, ${row.shopId}, ${row.ownerId}, ${row.adminId}, ${JSON.stringify(row.payload)}::jsonb)
        `;
      }
    });
    console.log(`Projection complete: ${rows.length} records.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
