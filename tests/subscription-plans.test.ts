import assert from "node:assert/strict";
import test from "node:test";
import { ensureSubscriptionDefaults, PLAN_CONFIG } from "../lib/server/subscription";
import type { AdminProfile } from "../lib/server/data-store";

test("public pricing matches the permanent Free, Pro, and Business plans", () => {
  assert.equal(PLAN_CONFIG.trial.label, "Free");
  assert.equal(PLAN_CONFIG.trial.priceYearly, 0);
  assert.equal(PLAN_CONFIG.trial.productLimit, 50);
  assert.equal(PLAN_CONFIG.pro.priceMonthly, 49_000);
  assert.equal(PLAN_CONFIG.pro.priceYearly, 468_000);
  assert.equal(PLAN_CONFIG.business.priceMonthly, 129_000);
  assert.equal(PLAN_CONFIG.business.priceYearly, 1_188_000);
  assert.equal(PLAN_CONFIG.business.branchLimit, 5);
});

test("legacy trial profiles are normalized to permanent Free access", () => {
  const profile = {
    planType: "trial",
    planStatus: "trialing",
    activeUntil: "2020-01-01",
    isActive: false,
  } as AdminProfile;

  ensureSubscriptionDefaults(profile);

  assert.equal(profile.planStatus, "active");
  assert.equal(profile.activeUntil, null);
  assert.equal(profile.isActive, true);
});
