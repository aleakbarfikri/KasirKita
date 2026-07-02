import { getShopByIdFromDb, getUserByIdFromDb, publicUser, type AppDb, type CashierProfile } from "@/lib/server/data-store";

export function rowWithCashierProfile(db: AppDb, profile: CashierProfile) {
  const cashier = getUserByIdFromDb(db, profile.userId);
  const shop = getShopByIdFromDb(db, profile.shopId);
  if (!cashier || !shop) return null;
  return {
    cashier: publicUser(cashier),
    profile,
    shop,
  };
}
