import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { onlineOrderStatusSchema } from "@/lib/server/validators";
import { addAuditLog, now, withDbTransaction } from "@/lib/server/data-store";
import { canTransitionOnlineOrder } from "@/lib/server/online-orders";

type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, props: Params) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "admin") return fail("Hanya admin yang dapat memperbarui pesanan online.", 403);
    const scope = await getAdminScope(session.user.id);
    const { id } = await props.params;
    const body = onlineOrderStatusSchema.parse(await readJson(request));
    const updated = await withDbTransaction((db) => {
      const order = db.onlineOrders.find((row) => row.id === id && row.shopId === scope.shopId);
      if (!order) throw Object.assign(new Error("Pesanan online tidak ditemukan."), { status: 404 });
      if (!canTransitionOnlineOrder(order.status, body.status)) throw Object.assign(new Error("Perubahan status pesanan tidak valid."), { status: 409 });
      order.status = body.status;
      order.updatedAt = now();
      addAuditLog(db, { actorId: session.user.id, actorRole: "admin", shopId: scope.shopId, action: "update_online_order", entityType: "online_order", entityId: order.id, message: `Status pesanan online ${order.id} diubah menjadi ${order.status}.`, metadata: { status: order.status, transactionId: order.transactionId } });
      return { ...order };
    });
    return ok(updated);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
