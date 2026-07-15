import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { buildReceipt } from "@/lib/server/receipt";
import { readDb, sortDesc } from "@/lib/server/data-store";
import { isOnlineOrderVisible, onlineOrderNumber } from "@/lib/server/online-orders";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "admin") return fail("Hanya admin yang dapat mengakses pesanan online.", 403);
    const scope = await getAdminScope(session.user.id);
    const db = await readDb();
    const origin = new URL(request.url).origin;
    const rows = sortDesc(db.onlineOrders.filter((row) => row.shopId === scope.shopId && isOnlineOrderVisible(row.status, row.updatedAt))).map((order) => {
      const transaction = db.transactions.find((row) => row.id === order.transactionId)!;
      const items = db.transactionItems.filter((row) => row.transactionId === order.transactionId).map((row) => ({ id: row.id, name: row.name, quantity: row.quantity, price: row.price, subtotal: row.subtotal }));
      return { ...order, orderNumber: order.orderNumber || onlineOrderNumber(order.id, order.createdAt), transaction: { id: transaction.id, total: transaction.total, status: transaction.status, createdAt: transaction.createdAt }, items, receipt: transaction.status === "success" ? buildReceipt(db, transaction, origin) : null };
    });
    return ok(rows);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
