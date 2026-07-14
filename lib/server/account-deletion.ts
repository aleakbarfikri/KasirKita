import type { AppDb, UserRole } from "@/lib/server/data-store";

export type AccountDeletionResult = { role: UserRole; deletedUsers: number; deletedShop: boolean };

export function deleteAccountData(db: AppDb, userId: string): AccountDeletionResult {
  const user = db.users.find((row) => row.id === userId);
  if (!user) throw Object.assign(new Error("Akun tidak ditemukan."), { status: 404 });
  if (user.role === "owner") {
    throw Object.assign(new Error("Akun Owner platform tidak dapat dihapus dari aplikasi. Hubungi dukungan KasirKita."), { status: 403 });
  }

  if (user.role === "cashier") {
    db.sessions = db.sessions.filter((row) => row.userId !== userId);
    db.cashierProfiles = db.cashierProfiles.filter((row) => row.userId !== userId);
    db.users = db.users.filter((row) => row.id !== userId);
    db.emailVerifications = db.emailVerifications.filter((row) => row.email.toLowerCase() !== user.email.toLowerCase());
    return { role: user.role, deletedUsers: 1, deletedShop: false };
  }

  const profile = db.adminProfiles.find((row) => row.userId === userId);
  const shopId = profile?.shopId;
  const cashierIds = new Set(db.cashierProfiles.filter((row) => row.adminId === userId || (shopId && row.shopId === shopId)).map((row) => row.userId));
  const userIds = new Set([userId, ...Array.from(cashierIds)]);
  const emails = new Set(db.users.filter((row) => userIds.has(row.id)).map((row) => row.email.toLowerCase()));
  const transactionIds = new Set(db.transactions.filter((row) => row.shopId === shopId).map((row) => row.id));
  const debtIds = new Set(db.debts.filter((row) => row.adminId === userId || row.shopId === shopId).map((row) => row.id));

  db.sessions = db.sessions.filter((row) => !userIds.has(row.userId));
  db.users = db.users.filter((row) => !userIds.has(row.id));
  db.adminProfiles = db.adminProfiles.filter((row) => row.userId !== userId);
  db.cashierProfiles = db.cashierProfiles.filter((row) => row.adminId !== userId && !userIds.has(row.userId));
  db.shops = db.shops.filter((row) => row.id !== shopId);
  db.products = db.products.filter((row) => row.shopId !== shopId);
  db.transactions = db.transactions.filter((row) => row.shopId !== shopId);
  db.transactionItems = db.transactionItems.filter((row) => !transactionIds.has(row.transactionId));
  db.balances = db.balances.filter((row) => row.adminId !== userId);
  db.withdrawals = db.withdrawals.filter((row) => row.adminId !== userId);
  db.debts = db.debts.filter((row) => !debtIds.has(row.id));
  db.debtPayments = db.debtPayments.filter((row) => !debtIds.has(row.debtId));
  db.auditLogs = db.auditLogs.filter((row) => row.shopId !== shopId && !userIds.has(row.actorId));
  db.cashShifts = db.cashShifts.filter((row) => row.shopId !== shopId && !userIds.has(row.cashierId));
  db.subscriptionInvoices = db.subscriptionInvoices.filter((row) => row.adminId !== userId);
  db.receiptSettings = db.receiptSettings.filter((row) => row.shopId !== shopId);
  db.onlineOrders = db.onlineOrders.filter((row) => row.shopId !== shopId && row.adminId !== userId);
  db.emailVerifications = db.emailVerifications.filter((row) => !emails.has(row.email.toLowerCase()));

  return { role: user.role, deletedUsers: userIds.size, deletedShop: Boolean(shopId) };
}
