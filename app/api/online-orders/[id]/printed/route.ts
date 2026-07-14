import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { now, withDbTransaction } from "@/lib/server/data-store";

type Params = { params: Promise<{ id: string }> };
export async function POST(_request: Request, props: Params) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "admin") return fail("Hanya admin yang dapat menandai struk.", 403);
    const scope = await getAdminScope(session.user.id);
    const { id } = await props.params;
    const order = await withDbTransaction((db) => {
      const row = db.onlineOrders.find((item) => item.id === id && item.shopId === scope.shopId);
      if (!row) throw Object.assign(new Error("Pesanan tidak ditemukan."), { status: 404 });
      row.printedAt = row.printedAt ?? now();
      row.updatedAt = now();
      return { ...row };
    });
    return ok(order);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
