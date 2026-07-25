import assert from "node:assert/strict";
import test from "node:test";
import { defaultDb } from "../lib/server/data-store";
import { projectNormalizedRows } from "../lib/server/normalized-projection";

test("normalized projection gives receipt settings stable tenant ids", () => {
  const db = defaultDb();
  db.receiptSettings.push(
    { shopId: "shop_1", paperWidth: "58mm", printCopies: 1, showQueueNumber: true, autoPrint: false, updatedAt: "2026-07-21T00:00:00.000Z" },
    { shopId: "shop_2", paperWidth: "80mm", printCopies: 2, showQueueNumber: false, autoPrint: true, updatedAt: "2026-07-21T00:00:00.000Z" },
  );
  const rows = projectNormalizedRows(db).filter((row) => row.entityType === "receiptSettings");
  assert.deepEqual(rows.map((row) => row.entityId).sort(), ["shop_1", "shop_2"]);
  assert.equal(new Set(rows.map((row) => `${row.entityType}:${row.entityId}`)).size, rows.length);
});

test("all projected entities have non-empty unique composite ids", () => {
  const db = defaultDb();
  const rows = projectNormalizedRows(db);
  assert.ok(rows.every((row) => row.entityId.trim().length > 0));
  assert.equal(new Set(rows.map((row) => `${row.entityType}:${row.entityId}`)).size, rows.length);
});
