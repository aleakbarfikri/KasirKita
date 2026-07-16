import { jakartaDateString, now, type AdminProfile, type AppDb } from "@/lib/server/data-store";

export type SubscriptionPlan = "trial" | "basic" | "starter" | "pro" | "business";
export type PaidSubscriptionPlan = Exclude<SubscriptionPlan, "trial">;
export type BillingPeriod = "monthly" | "yearly";
export type FeatureKey = "discounts" | "importExport" | "qrisPakasir" | "debts" | "shifts" | "backupRestore" | "multiCashier" | "productPhotos";

export type PlanConfig = {
  label: string;
  priceMonthly: number | null;
  priceYearly: number;
  productLimit: number | null;
  cashierLimit: number | null;
  monthlyTransactionLimit: number | null;
  branchLimit: number | null;
  reportDays: number | null;
  features: Record<FeatureKey, boolean>;
};

const basicFeatures: Record<FeatureKey, boolean> = {
  discounts: false,
  importExport: false,
  qrisPakasir: false,
  debts: false,
  shifts: false,
  backupRestore: false,
  multiCashier: false,
  productPhotos: false,
};

export const PLAN_CONFIG: Record<SubscriptionPlan, PlanConfig> = {
  trial: {
    label: "Free",
    priceMonthly: null,
    priceYearly: 0,
    productLimit: 50,
    cashierLimit: 1,
    monthlyTransactionLimit: 500,
    branchLimit: 1,
    reportDays: 30,
    features: { ...basicFeatures, discounts: true, qrisPakasir: true },
  },
  basic: {
    label: "Basic",
    priceMonthly: null,
    priceYearly: 100_000,
    productLimit: 300,
    cashierLimit: 1,
    monthlyTransactionLimit: 500,
    branchLimit: 1,
    reportDays: 7,
    features: { ...basicFeatures, discounts: true },
  },
  starter: {
    label: "Starter",
    priceMonthly: 19_000,
    priceYearly: 190_000,
    productLimit: 500,
    cashierLimit: 1,
    monthlyTransactionLimit: 1_000,
    branchLimit: 1,
    reportDays: 30,
    features: {
      ...basicFeatures,
      discounts: true,
    },
  },
  pro: {
    label: "Pro",
    priceMonthly: 49_000,
    priceYearly: 468_000,
    productLimit: 5_000,
    cashierLimit: 5,
    monthlyTransactionLimit: 10_000,
    branchLimit: 1,
    reportDays: 90,
    features: {
      discounts: true,
      importExport: true,
      qrisPakasir: true,
      debts: true,
      shifts: true,
      backupRestore: true,
      multiCashier: true,
      productPhotos: true,
    },
  },
  business: {
    label: "Business",
    priceMonthly: 129_000,
    priceYearly: 1_188_000,
    productLimit: null,
    cashierLimit: null,
    monthlyTransactionLimit: null,
    branchLimit: 5,
    reportDays: null,
    features: {
      discounts: true,
      importExport: true,
      qrisPakasir: true,
      debts: true,
      shifts: true,
      backupRestore: true,
      multiCashier: true,
      productPhotos: true,
    },
  },
};

export function normalizePlanType(value?: string | null): SubscriptionPlan {
  if (value === "trial" || value === "basic" || value === "starter" || value === "pro" || value === "business") return value;
  return "pro";
}

export function getPlanConfig(value?: string | null) {
  return PLAN_CONFIG[normalizePlanType(value)];
}

export function isProfileExpired(profile: Pick<AdminProfile, "activeUntil">, date = new Date()) {
  return Boolean(profile.activeUntil && profile.activeUntil < jakartaDateString(date));
}

export function getSubscriptionStatus(profile: AdminProfile) {
  if (!profile.isActive) return "inactive";
  if (isProfileExpired(profile)) return "expired";
  return profile.planStatus || (profile.planType === "trial" ? "trialing" : "active");
}

export function ensureSubscriptionDefaults(profile: AdminProfile) {
  if (!profile.planType) profile.planType = "pro";
  if (profile.planType === "trial") {
    profile.planStatus = "active";
    profile.activeUntil = null;
    profile.isActive = true;
  } else if (!profile.planStatus) profile.planStatus = "active";
  return profile;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function dateInputValue(date: Date) {
  return jakartaDateString(date);
}

export function nextActiveUntil(current: string | null | undefined, period: BillingPeriod) {
  const today = new Date(`${jakartaDateString()}T00:00:00+07:00`);
  const base = current && current >= jakartaDateString() ? new Date(`${current}T00:00:00+07:00`) : today;
  return dateInputValue(period === "yearly" ? addMonths(base, 12) : addMonths(base, 1));
}

export function startTrialProfile(profile: AdminProfile, trialDays = 14) {
  const t = now();
  profile.planType = "trial";
  profile.planStatus = "active";
  profile.trialStartedAt = t;
  profile.subscriptionStartedAt = null;
  // Free is a permanent entry plan. Keep the trialDays argument for backward compatibility.
  profile.activeUntil = null;
  profile.isActive = true;
  profile.updatedAt = t;
  return profile;
}

export function applyManualSubscription(profile: AdminProfile, planType: SubscriptionPlan, activeUntil?: string | null) {
  const t = now();
  profile.planType = planType;
  profile.planStatus = planType === "trial" ? "active" : "manual";
  profile.subscriptionStartedAt = planType === "trial" ? null : profile.subscriptionStartedAt || t;
  profile.activeUntil = activeUntil || null;
  profile.isActive = true;
  profile.updatedAt = t;
  return profile;
}

export function applyPaidSubscription(profile: AdminProfile, planType: PaidSubscriptionPlan, period: BillingPeriod) {
  const t = now();
  profile.planType = planType;
  profile.planStatus = "active";
  profile.subscriptionStartedAt = profile.subscriptionStartedAt || t;
  profile.activeUntil = nextActiveUntil(profile.activeUntil, period);
  profile.isActive = true;
  profile.updatedAt = t;
  return profile;
}

export function assertFeatureAllowed(profile: AdminProfile, feature: FeatureKey) {
  ensureSubscriptionDefaults(profile);
  const plan = getPlanConfig(profile.planType);
  if (!plan.features[feature]) {
    throw Object.assign(new Error(`Fitur ini tersedia di paket Pro/Business. Paket aktif: ${plan.label}.`), { status: 402 });
  }
}

export function assertProductLimit(db: AppDb, profile: AdminProfile, incomingCount = 1) {
  ensureSubscriptionDefaults(profile);
  const limit = getPlanConfig(profile.planType).productLimit;
  if (limit === null) return;
  const activeCount = db.products.filter((product) => product.shopId === profile.shopId && product.isActive).length;
  if (activeCount + incomingCount > limit) {
    throw Object.assign(new Error(`Limit produk paket ${getPlanConfig(profile.planType).label} adalah ${limit}. Upgrade paket untuk tambah produk lagi.`), { status: 402 });
  }
}

export function assertCashierLimit(db: AppDb, profile: AdminProfile, incomingCount = 1) {
  ensureSubscriptionDefaults(profile);
  const limit = getPlanConfig(profile.planType).cashierLimit;
  if (limit === null) return;
  const activeCount = db.cashierProfiles.filter((cashier) => cashier.adminId === profile.userId && cashier.isActive && cashier.approvalStatus !== "rejected").length;
  if (activeCount + incomingCount > limit) {
    throw Object.assign(new Error(`Limit kasir paket ${getPlanConfig(profile.planType).label} adalah ${limit}. Upgrade paket untuk tambah kasir lagi.`), { status: 402 });
  }
}

export function assertBranchLimit(db: AppDb, ownerId: string, profile: AdminProfile, incomingCount = 1) {
  ensureSubscriptionDefaults(profile);
  const limit = getPlanConfig(profile.planType).branchLimit;
  if (limit === null) return;
  const count = db.adminProfiles.filter((row) => row.ownerId === ownerId && row.isActive).length;
  if (count + incomingCount > limit) {
    throw Object.assign(new Error(`Paket ${getPlanConfig(profile.planType).label} maksimal ${limit} cabang. Upgrade ke Business untuk sampai 5 cabang.`), { status: 402 });
  }
}

export function assertMonthlyTransactionLimit(db: AppDb, profile: AdminProfile) {
  ensureSubscriptionDefaults(profile);
  const limit = getPlanConfig(profile.planType).monthlyTransactionLimit;
  if (limit === null) return;
  const monthKey = jakartaDateString().slice(0, 7);
  const count = db.transactions.filter((trx) => trx.shopId === profile.shopId && trx.createdAt.slice(0, 7) === monthKey).length;
  if (count >= limit) {
    throw Object.assign(new Error(`Limit transaksi bulanan paket ${getPlanConfig(profile.planType).label} adalah ${limit}. Upgrade paket untuk lanjut transaksi.`), { status: 402 });
  }
}
