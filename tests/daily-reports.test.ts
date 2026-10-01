import assert from "node:assert/strict";
import test from "node:test";
import { jakartaDateKey, shiftDateKey } from "../lib/report-dates";
import { dailyTransactionSummary } from "../lib/report-summary";

test("transaction day follows Jakarta midnight, including earlier dates", () => {
  assert.equal(jakartaDateKey("2026-09-30T16:59:59.000Z"), "2026-09-30");
  assert.equal(jakartaDateKey("2026-09-30T17:00:00.000Z"), "2026-10-01");
  assert.equal(shiftDateKey("2026-10-01", -1), "2026-09-30");
});

test("daily dashboard totals include only successful sales for chosen day", () => {
  const rows = [
    { createdAt: "2026-09-30T16:59:00.000Z", status: "success", total: 15000, costTotal: 9000, grossProfit: 6000 },
    { createdAt: "2026-09-30T17:01:00.000Z", status: "success", total: 8000, costTotal: 5000, grossProfit: 3000 },
    { createdAt: "2026-09-30T17:02:00.000Z", status: "pending", total: 12000, costTotal: 7000, grossProfit: 5000 },
  ];
  assert.deepEqual(dailyTransactionSummary(rows, "2026-09-30"), { sales: 15000, cost: 9000, profit: 6000, count: 1 });
  assert.deepEqual(dailyTransactionSummary(rows, "2026-10-01"), { sales: 8000, cost: 5000, profit: 3000, count: 1 });
});
