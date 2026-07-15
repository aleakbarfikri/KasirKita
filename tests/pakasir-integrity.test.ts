import assert from "node:assert/strict";
import test from "node:test";
import { PakasirIntegrityError, validatePakasirCreatePayload, validatePakasirStatusPayload } from "../lib/server/pakasir";

const input = { slug: "kasirkita", apiKey: "server-only-key", orderId: "trx_123", amount: 50_000 };

function validCreatePayment() {
  return {
    project: "kasirkita",
    order_id: "trx_123",
    amount: 50_000,
    fee: 500,
    total_payment: 50_500,
    payment_method: "qris",
    payment_number: "000201010212-test-qris",
    expired_at: "2026-07-15T12:00:00.000Z",
  };
}

function validStatusTransaction(status = "completed") {
  return {
    project: "kasirkita",
    order_id: "trx_123",
    amount: 50_000,
    status,
    payment_method: "qris",
  };
}

test("Pakasir create response is accepted only when its identity and totals match", () => {
  const result = validatePakasirCreatePayload(input, { payment: validCreatePayment() });
  assert.equal(result.totalPayment, 50_500);
  assert.equal(result.fee, 500);
  assert.equal(result.qrString, "000201010212-test-qris");
});

for (const [field, value] of [
  ["order_id", "trx_attacker"],
  ["amount", 1],
  ["project", "other-project"],
  ["payment_method", "bni_va"],
] as const) {
  test(`Pakasir create response rejects mismatched ${field}`, () => {
    const payment = { ...validCreatePayment(), [field]: value };
    assert.throws(() => validatePakasirCreatePayload(input, { payment }), PakasirIntegrityError);
  });
}

test("Pakasir create response rejects manipulated total or malformed expiry", () => {
  assert.throws(() => validatePakasirCreatePayload(input, { payment: { ...validCreatePayment(), total_payment: 50_001 } }), PakasirIntegrityError);
  assert.throws(() => validatePakasirCreatePayload(input, { payment: { ...validCreatePayment(), expired_at: "not-a-date" } }), PakasirIntegrityError);
});

test("only the documented completed status confirms a matching transaction", () => {
  assert.deepEqual(validatePakasirStatusPayload(input, { transaction: validStatusTransaction("completed") }), { status: "completed", isPaid: true });
  for (const status of ["pending", "paid", "success", "settlement"]) {
    assert.equal(validatePakasirStatusPayload(input, { transaction: validStatusTransaction(status) }).isPaid, false);
  }
});

for (const [field, value] of [
  ["order_id", "trx_attacker"],
  ["amount", 99_000],
  ["project", "other-project"],
  ["payment_method", "permata_va"],
] as const) {
  test(`Pakasir detail response rejects mismatched ${field}`, () => {
    const transaction = { ...validStatusTransaction(), [field]: value };
    assert.throws(() => validatePakasirStatusPayload(input, { transaction }), PakasirIntegrityError);
  });
}

test("missing or malformed Pakasir response never confirms payment", () => {
  assert.throws(() => validatePakasirCreatePayload(input, {}), PakasirIntegrityError);
  assert.throws(() => validatePakasirStatusPayload(input, { transaction: { status: "completed" } }), PakasirIntegrityError);
});
