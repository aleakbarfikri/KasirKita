import assert from "node:assert/strict";
import test from "node:test";
import { defaultDb, type Transaction } from "../lib/server/data-store";
import {
  appendLedgerJournal,
  recordDebtPayment,
  recordSuccessfulSale,
  recordTransactionVoid,
  verifyLedger,
} from "../lib/server/financial-ledger";

function transaction(paymentMethod: Transaction["paymentMethod"] = "cash"): Transaction {
  return {
    id: `trx_${paymentMethod}`,
    shopId: "shop_1",
    cashierId: "admin_1",
    paymentMethod,
    total: 25_000,
    status: "success",
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
  };
}

test("ledger journals remain balanced and idempotent", () => {
  const db = defaultDb();
  const trx = transaction("qris_pakasir");
  const first = recordSuccessfulSale(db, trx, { ownerId: "owner_1", adminId: "admin_1" });
  const replay = recordSuccessfulSale(db, trx, { ownerId: "owner_1", adminId: "admin_1" });

  assert.equal(first.applied, true);
  assert.equal(replay.applied, false);
  assert.equal(db.financialLedgerEntries.length, 1);
  assert.deepEqual(verifyLedger(db.financialLedgerEntries), { entries: 1, balanced: true });
});

test("void journal exactly reverses the successful sale", () => {
  const db = defaultDb();
  const trx = transaction("cash");
  recordSuccessfulSale(db, trx, { ownerId: "owner_1", adminId: "admin_1" });
  recordTransactionVoid(db, trx, { ownerId: "owner_1", adminId: "admin_1" });

  const accountNet = new Map<string, number>();
  for (const entry of db.financialLedgerEntries) {
    for (const line of entry.lines) {
      const signed = line.side === "debit" ? line.amount : -line.amount;
      accountNet.set(line.account, (accountNet.get(line.account) ?? 0) + signed);
    }
  }
  assert.equal(accountNet.get("asset:cash"), 0);
  assert.equal(accountNet.get("income:sales"), 0);
  assert.deepEqual(verifyLedger(db.financialLedgerEntries), { entries: 2, balanced: true });
});

test("debt collection moves value from receivable to cash", () => {
  const db = defaultDb();
  recordDebtPayment(db, {
    paymentId: "debtpay_1",
    debtId: "debt_1",
    amount: 10_000,
    ownerId: "owner_1",
    adminId: "admin_1",
    shopId: "shop_1",
  });
  assert.deepEqual(db.financialLedgerEntries[0].lines, [
    { account: "asset:cash", side: "debit", amount: 10_000 },
    { account: "asset:accounts_receivable", side: "credit", amount: 10_000 },
  ]);
});

test("unbalanced journals are rejected", () => {
  const db = defaultDb();
  assert.throws(() => appendLedgerJournal(db, {
    journalKey: "invalid",
    sourceType: "transaction",
    sourceId: "trx_invalid",
    description: "invalid",
    lines: [
      { account: "asset:cash", side: "debit", amount: 100 },
      { account: "income:sales", side: "credit", amount: 99 },
    ],
  }), /not balanced/);
});

test("a fully discounted zero-value sale does not create an invalid journal", () => {
  const db = defaultDb();
  const trx = transaction();
  trx.total = 0;
  assert.equal(recordSuccessfulSale(db, trx, { ownerId: "owner", adminId: "admin" }).applied, false);
  assert.equal(recordTransactionVoid(db, trx, { ownerId: "owner", adminId: "admin" }).applied, false);
  assert.deepEqual(db.financialLedgerEntries, []);
});
