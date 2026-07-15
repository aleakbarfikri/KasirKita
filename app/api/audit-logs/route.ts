import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { readDb } from "@/lib/server/data-store";
import { ownerAuditLogRows, shopAuditLogRows } from "@/lib/server/audit-log-view";

export async function GET() {
  try {
    const session = await requireAuth();
    const db = await readDb();

    if (session.user.role === "owner") {
      return ok(ownerAuditLogRows(db, session.user.id));
    }

    if (session.user.role === "admin" || session.user.role === "cashier") {
      const scope = await getAdminScope(session.user.id);
      return ok(shopAuditLogRows(db, scope.shopId, session.user.id));
    }

    return fail("Unauthorized", 401);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
