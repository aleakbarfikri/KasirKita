import fs from "node:fs";
import path from "node:path";
import "dotenv/config";

import { createBackup, writeDb, type AppDb } from "../lib/server/data-store";

function resolveSourceFile() {
  if (process.env.KASIRKITA_MIGRATION_SOURCE) return process.env.KASIRKITA_MIGRATION_SOURCE;
  return path.join(process.cwd(), ".data", "kasirkita-db.json");
}

async function main() {
  const databaseUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error("Set POSTGRES_URL atau DATABASE_URL ke connection string Postgres sebelum migrasi.");
  }

  const sourceFile = resolveSourceFile();
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`File sumber tidak ditemukan: ${sourceFile}`);
  }

  const db = JSON.parse(fs.readFileSync(sourceFile, "utf8")) as AppDb;
  await writeDb(db);
  const backup = await createBackup("migration-snapshot");
  console.log(`Migrasi selesai dari ${sourceFile}`);
  console.log(`Backup awal dibuat: ${backup.id}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
