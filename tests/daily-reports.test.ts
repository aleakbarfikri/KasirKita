import assert from "node:assert/strict";
import test from "node:test";
import { jakartaDateKey, shiftDateKey } from "../lib/report-dates";
import { dailyTransactionSummary, dateRangeTransactionSummary } from "../lib/report-summary";

test("transaction day follows Jakarta midnight, including earlier dates", () => {
  assert.equal(jakartaDateKey("2026-09-30T16:59:59.000Z"), "2026-09-30");
  assert.equal(jakartaDateKey("2026-09-30T17:00:00.000Z"), "2026-10-01");
  assert.equal(shiftDateKey("2026-10-01", -1), "2026-09-30");
});

test("dashboard range totals include both dates in Jakarta and exclude pending sales", () => {
  const rows = [
    { createdAt: "2026-10-31T16:59:00.000Z", status: "success", total: 1000, costTotal: 400 },
    { createdAt: "2026-10-31T17:00:00.000Z", status: "success", total: 2000, costTotal: 800 },
    { createdAt: "2026-11-07T16:59:00.000Z", status: "success", total: 3000, costTotal: 1200 },
    { createdAt: "2026-11-07T17:00:00.000Z", status: "success", total: 4000, costTotal: 1600 },
    { createdAt: "2026-11-03T12:00:00.000Z", status: "pending", total: 5000, costTotal: 2000 },
  ];
  assert.deepEqual(dateRangeTransactionSummary(rows, "2026-11-01", "2026-11-07"), { sales: 5000, cost: 2000, profit: 3000, count: 2 });
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
