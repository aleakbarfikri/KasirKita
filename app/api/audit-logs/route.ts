import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { readDb, sortDesc } from "@/lib/server/data-store";

export async function GET() {
  try {
    const session = await requireAuth();
    const db = await readDb();

    if (session.user.role === "owner") {
      const ownerShopIds = new Set(db.shops.filter((shop) => shop.ownerId === session.user.id).map((shop) => shop.id));
      const rows = db.auditLogs.filter((log) => !log.shopId || ownerShopIds.has(log.shopId)).slice(-200);
      return ok(sortDesc(rows));
    }

    if (session.user.role === "admin" || session.user.role === "cashier") {
      const scope = await getAdminScope(session.user.id);
      const rows = db.auditLogs.filter((log) => log.shopId === scope.shopId || log.actorId === session.user.id).slice(-200);
      return ok(sortDesc(rows));
    }

    return fail("Unauthorized", 401);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
