import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { readDb, sortDesc } from "@/lib/server/data-store";
import { transactionProfit } from "@/lib/server/profit";

function rowItems(db: Awaited<ReturnType<typeof readDb>>, transactionId: string) {
  return db.transactionItems.filter((item) => item.transactionId === transactionId);
}

export async function GET() {
  try {
    const session = await requireAuth();
    const db = await readDb();
    if (session.user.role === "owner") {
      const ownerShops = db.shops.filter((shop) => shop.ownerId === session.user.id);
      const rows = db.transactions
        .filter((trx) => ownerShops.some((shop) => shop.id === trx.shopId))
        .map((trx) => ({ ...trx, ...transactionProfit(db, trx), items: rowItems(db, trx.id), shopName: ownerShops.find((shop) => shop.id === trx.shopId)?.name, cashierName: db.users.find((user) => user.id === trx.cashierId)?.name }));
      return ok(sortDesc(rows));
    }

    const scope = await getAdminScope(session.user.id);
    const rows = db.transactions
      .filter((trx) => trx.shopId === scope.shopId && (session.user.role === "cashier" ? trx.cashierId === session.user.id : true))
      .map((trx) => ({ ...trx, ...transactionProfit(db, trx), items: rowItems(db, trx.id), shopName: scope.shopName, cashierName: db.users.find((user) => user.id === trx.cashierId)?.name }));
    return ok(sortDesc(rows));
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
