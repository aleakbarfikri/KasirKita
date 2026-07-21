import "dotenv/config";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { normalizeRestoredDb, type AppDb } from "../lib/server/data-store";
import { verifyLedger } from "../lib/server/financial-ledger";
import { decryptBackup, type EncryptedBackupEnvelope } from "../lib/server/offsite-backup";

function isEncryptedEnvelope(value: unknown): value is EncryptedBackupEnvelope {
  return Boolean(value && typeof value === "object" && (value as { algorithm?: string }).algorithm === "aes-256-gcm");
}

function extractDatabase(value: unknown): AppDb {
  if (isEncryptedEnvelope(value)) return decryptBackup(value);
  if (value && typeof value === "object" && "data" in value) {
    return normalizeRestoredDb((value as { data: unknown }).data);
  }
  return normalizeRestoredDb(value);
}

function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Gunakan: npm run backup:verify -- /path/ke/backup.json");
  const filename = path.resolve(input);
  const raw = fs.readFileSync(filename, "utf8");
  const db = extractDatabase(JSON.parse(raw));
  const ledger = verifyLedger(db.financialLedgerEntries);
  const recordCount = Object.values(db).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
  const checksum = crypto.createHash("sha256").update(JSON.stringify(db)).digest("hex");
  console.log(JSON.stringify({ ok: true, file: path.basename(filename), recordCount, ledger, checksum }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
