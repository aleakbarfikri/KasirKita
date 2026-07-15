import { z } from "zod";
import { fail, ok, readJson } from "@/lib/server/http";
import { readDb } from "@/lib/server/data-store";
import { paymentCredentials } from "@/lib/server/payment-secrets";
import { reconcileOnlineOrderPayment } from "@/lib/server/online-order-payment";
import { reportServerError } from "@/lib/server/monitoring";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const webhookSchema = z.object({
  amount: z.coerce.number().int().positive(),
  order_id: z.string().trim().min(1).max(128),
  project: z.string().trim().min(1).max(128),
  status: z.literal("completed"),
  payment_method: z.literal("qris"),
  completed_at: z.string().datetime({ offset: true }).optional(),
}).strict();

export async function POST(request: Request) {
  const ipLimit = await enforceRateLimit(request, "pakasir-webhook-ip", { limit: 120, windowMs: 60_000 });
  if (!ipLimit.allowed) return fail("Terlalu banyak permintaan.", 429);
  const parsed = webhookSchema.safeParse(await readJson(request));
  if (!parsed.success) return fail("Webhook tidak valid.", 400);
  const orderLimit = await enforceRateLimit(request, "pakasir-webhook-order", { limit: 12, windowMs: 5 * 60_000 }, parsed.data.order_id);
  if (!orderLimit.allowed) return fail("Terlalu banyak permintaan.", 429);

  const db = await readDb();
  const transaction = db.transactions.find((row) => row.id === parsed.data.order_id && row.externalRef === parsed.data.order_id && row.paymentMethod === "qris_pakasir");
  const order = transaction ? db.onlineOrders.find((row) => row.transactionId === transaction.id) : null;

  // Acknowledge unknown events without exposing which transaction IDs exist.
  if (!transaction || !order) return ok({ received: true }, { status: 202 });
  if (transaction.total !== parsed.data.amount) return fail("Webhook tidak valid.", 400);

  const profile = db.adminProfiles.find((row) => row.userId === order.adminId && row.shopId === order.shopId);
  const config = profile ? db.paymentConfigs.find((row) => row.ownerId === profile.ownerId) : null;
  const credentials = paymentCredentials(config);
  if (!credentials.pakasirSlug || credentials.pakasirSlug !== parsed.data.project) return fail("Webhook tidak valid.", 400);

  try {
    // The unsigned webhook is only a trigger. Transaction Detail remains authoritative.
    await reconcileOnlineOrderPayment(order.id, new URL(request.url).origin);
    return ok({ received: true });
  } catch (error) {
    reportServerError(error, { operation: "pakasir_webhook_reconciliation", orderId: order.id });
    return fail("Status pembayaran belum dapat diverifikasi.", 503);
  }
}
