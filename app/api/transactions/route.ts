import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { readDb, sortDesc } from "@/lib/server/data-store";
import { transactionProfit } from "@/lib/server/profit";
import { onlineOrderNumber } from "@/lib/server/online-orders";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const db = await readDb();
    const rawLimit = new URL(request.url).searchParams.get("limit");
    const limit = rawLimit && /^\d+$/.test(rawLimit) ? Math.min(Number(rawLimit), 100) : null;
    const itemsByTransaction = new Map<string, typeof db.transactionItems>();
    for (const item of db.transactionItems) {
      const items = itemsByTransaction.get(item.transactionId) ?? [];
      items.push(item);
      itemsByTransaction.set(item.transactionId, items);
    }
    const orderByTransaction = new Map(db.onlineOrders.map((order) => [order.transactionId, order]));
    const shopById = new Map(db.shops.map((shop) => [shop.id, shop]));
    const userById = new Map(db.users.map((user) => [user.id, user]));
    const toRow = (trx: (typeof db.transactions)[number], shopName?: string) => {
      const items = itemsByTransaction.get(trx.id) ?? [];
      const order = orderByTransaction.get(trx.id);
      return { ...trx, ...transactionProfit(db, trx, items), items, onlineOrderNumber: order ? order.orderNumber || onlineOrderNumber(order.id, order.createdAt) : undefined, shopName, cashierName: userById.get(trx.cashierId)?.name };
    };
    if (session.user.role === "owner") {
      const ownerShopIds = new Set(db.shops.filter((shop) => shop.ownerId === session.user.id).map((shop) => shop.id));
      const transactions = sortDesc(db.transactions.filter((trx) => ownerShopIds.has(trx.shopId)));
      return ok((limit === null ? transactions : transactions.slice(0, limit)).map((trx) => toRow(trx, shopById.get(trx.shopId)?.name)));
    }

    const scope = await getAdminScope(session.user.id);
    const transactions = sortDesc(db.transactions.filter((trx) => trx.shopId === scope.shopId && (session.user.role === "cashier" ? trx.cashierId === session.user.id : true)));
    return ok((limit === null ? transactions : transactions.slice(0, limit)).map((trx) => toRow(trx, scope.shopName)));
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
