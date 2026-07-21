import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
    const stateKey = String(process.env.KASIRKITA_POSTGRES_STATE_KEY || "default");
    const stateRows = await sql<{ data: AppDb; version: number | string }[]>`
      SELECT data, version FROM kasirkita_app_state WHERE key = ${stateKey} LIMIT 1
    `;
    if (!stateRows[0]?.data) throw new Error("Data app_state utama tidak ditemukan.");
    const rows = projectNormalizedRows(stateRows[0].data);
    const canonical = (input: typeof rows) => input
      .map((row) => JSON.stringify({
        entityType: row.entityType,
        entityId: row.entityId,
        shopId: row.shopId,
        ownerId: row.ownerId,
        adminId: row.adminId,
        payload: row.payload,
      }))
      .sort()
      .join("\n");
    const expectedChecksum = crypto.createHash("sha256").update(canonical(rows)).digest("hex");
    const runId = `normalize_${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await sql.begin(async (transaction) => {
      await transaction`CREATE TEMP TABLE kasirkita_entities_v1_stage (LIKE kasirkita_entities_v1 INCLUDING ALL) ON COMMIT DROP`;
      for (const row of rows) {
        await transaction`
          INSERT INTO kasirkita_entities_v1_stage (entity_type, entity_id, shop_id, owner_id, admin_id, payload)
          VALUES (${row.entityType}, ${row.entityId}, ${row.shopId}, ${row.ownerId}, ${row.adminId}, ${JSON.stringify(row.payload)}::jsonb)
        `;
      }
      const projected = await transaction<{
        entityType: keyof AppDb;
        entityId: string;
        shopId: string | null;
        ownerId: string | null;
        adminId: string | null;
        payload: Record<string, unknown>;
      }[]>`
        SELECT entity_type AS "entityType", entity_id AS "entityId", shop_id AS "shopId",
               owner_id AS "ownerId", admin_id AS "adminId", payload
        FROM kasirkita_entities_v1_stage
      `;
      const actualChecksum = crypto.createHash("sha256").update(canonical(projected)).digest("hex");
      if (projected.length !== rows.length || actualChecksum !== expectedChecksum) {
        throw new Error("Verifikasi projection gagal. Data lama tidak diubah.");
      }
      await transaction`DELETE FROM kasirkita_entities_v1`;
      await transaction`
        INSERT INTO kasirkita_entities_v1 (entity_type, entity_id, shop_id, owner_id, admin_id, payload, projected_at)
        SELECT entity_type, entity_id, shop_id, owner_id, admin_id, payload, NOW()
        FROM kasirkita_entities_v1_stage
      `;
      await transaction`
        INSERT INTO kasirkita_normalization_runs (id, state_key, source_version, row_count, checksum)
        VALUES (${runId}, ${stateKey}, ${Number(stateRows[0].version)}, ${rows.length}, ${expectedChecksum})
      `;
    });
    console.log(`Projection complete and verified: ${rows.length} records (${expectedChecksum}).`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
