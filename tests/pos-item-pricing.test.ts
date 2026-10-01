import assert from "node:assert/strict";
import test from "node:test";
import { manualItemDiscount, posItemTotal } from "../lib/pos-item-pricing";
import { checkoutSchema } from "../lib/server/validators";

test("manual item discount applies only to this checkout item after bulk price", () => {
  const offers = [{ quantity: 2, total: 5000 }, { quantity: 3, total: 8000 }];
  assert.equal(posItemTotal(3000, 2, offers, "amount", 500), 4000);
  assert.equal(posItemTotal(3000, 3, offers, "percent", 10), 7100);
  assert.equal(posItemTotal(3000, 2, offers), 5000);
  assert.deepEqual(offers, [{ quantity: 2, total: 5000 }, { quantity: 3, total: 8000 }]);
});

test("manual discount is capped and checkout payload validates it", () => {
  assert.equal(manualItemDiscount(3000, "amount", 5000), 3000);
  assert.equal(posItemTotal(3000, 2, [{ quantity: 2, total: 5000 }], "amount", 5000), 0);
  const payload = { paymentMethod: "cash", paidAmount: 5000, items: [{ name: "Kopi", price: 3000, quantity: 2, manualDiscountType: "amount", manualDiscountValue: 500 }] };
  assert.equal(checkoutSchema.parse(payload).items[0].manualDiscountValue, 500);
  assert.equal(checkoutSchema.safeParse({ ...payload, items: [{ ...payload.items[0], manualDiscountValue: -1 }] }).success, false);
});
