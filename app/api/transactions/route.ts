import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { readDb, sortDesc } from "@/lib/server/data-store";

export async function GET() {
  try {
    const session = await requireAuth();
    const db = readDb();
    if (session.user.role === "owner") {
      const ownerShops = db.shops.filter((shop) => shop.ownerId === session.user.id);
      const rows = db.transactions
        .filter((trx) => ownerShops.some((shop) => shop.id === trx.shopId))
        .map((trx) => ({ ...trx, shopName: ownerShops.find((shop) => shop.id === trx.shopId)?.name }));
      return ok(sortDesc(rows));
    }

    const scope = await getAdminScope(session.user.id);
    const rows = db.transactions.filter((trx) => trx.shopId === scope.shopId && trx.cashierId === session.user.id);
    return ok(sortDesc(rows));
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
