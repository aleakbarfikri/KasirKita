import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

test("concurrent mutations are serialized without losing stock or transactions", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kasirkita-atomic-"));
  const file = path.join(directory, "db.json");
  process.env.KASIRKITA_DB_FILE = file;
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL;

  const { defaultDb, readDb, writeDb, withDbTransaction } = await import("../lib/server/data-store");
  const db = defaultDb();
  const timestamp = new Date().toISOString();
  db.products.push({
    id: "product_1",
    shopId: "shop_1",
    sku: "SKU-1",
    name: "Produk",
    price: 10_000,
    costPrice: 5_000,
    stock: 40,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await writeDb(db);

  await Promise.all(Array.from({ length: 40 }, (_, index) => withDbTransaction(async (current) => {
    const product = current.products.find((row) => row.id === "product_1")!;
    assert.ok(product.stock && product.stock > 0);
    await new Promise((resolve) => setTimeout(resolve, index % 3));
    product.stock = product.stock! - 1;
    current.transactions.push({
      id: `trx_${index}`,
      shopId: "shop_1",
      cashierId: "cashier_1",
      paymentMethod: "cash",
      total: 10_000,
      status: "success",
      idempotencyKey: `idem_${String(index).padStart(16, "0")}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  })));

  const result = await readDb();
  assert.equal(result.products[0].stock, 0);
  assert.equal(result.transactions.length, 40);
  assert.equal(new Set(result.transactions.map((row) => row.id)).size, 40);

  const duplicateKey = "same_idempotency_key_123";
  await Promise.all(Array.from({ length: 2 }, () => withDbTransaction((current) => {
    const existing = current.transactions.find((row) => row.idempotencyKey === duplicateKey);
    if (existing) return existing;
    const product = current.products[0];
    product.stock = (product.stock ?? 0) - 1;
    const transaction = {
      id: `trx_idempotent_${current.transactions.length}`,
      shopId: "shop_1",
      cashierId: "cashier_1",
      paymentMethod: "cash" as const,
      total: 10_000,
      status: "success" as const,
      idempotencyKey: duplicateKey,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    current.transactions.push(transaction);
    return transaction;
  })));

  const afterReplay = await readDb();
  assert.equal(afterReplay.transactions.filter((row) => row.idempotencyKey === duplicateKey).length, 1);
  assert.equal(afterReplay.products[0].stock, -1);
  fs.rmSync(directory, { recursive: true, force: true });
});
