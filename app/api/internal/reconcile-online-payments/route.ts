import { readDb, withDbTransaction } from "@/lib/server/data-store";
import { reconcileOnlineOrderPayment } from "@/lib/server/online-order-payment";
import { maintainOnlineOrders } from "@/lib/server/online-orders";
import { reportServerError } from "@/lib/server/monitoring";

export const maxDuration = 60;
const BATCH_SIZE = 50;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const db = await readDb();
  const orderIds = [...db.onlineOrders]
    .filter((order) => order.status === "pending_payment" || (order.status === "paid" && !order.invoiceEmailSentAt))
    .sort((a, b) => {
      const paidPriority = Number(b.status === "paid") - Number(a.status === "paid");
      return paidPriority || a.createdAt.localeCompare(b.createdAt);
    })
    .slice(0, BATCH_SIZE)
    .map((order) => order.id);
  const summary = { checked: orderIds.length, paid: 0, expired: 0, removed: 0, pending: 0, failed: 0 };

  for (const orderId of orderIds) {
    try {
      const result = await reconcileOnlineOrderPayment(orderId, new URL(request.url).origin);
      if (result.status === "paid") summary.paid += 1;
      else if (result.status === "expired") summary.expired += 1;
      else summary.pending += 1;
    } catch (error) {
      summary.failed += 1;
      reportServerError(error, { operation: "scheduled_online_payment_reconciliation", orderId });
    }
  }
  const maintenance = await withDbTransaction((current) => maintainOnlineOrders(current));
  summary.removed = maintenance.removed;
  return Response.json({ ok: true, data: summary });
}
