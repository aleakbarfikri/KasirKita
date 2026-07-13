import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { createId } from "@/lib/server/ids";
import { createPakasirQris } from "@/lib/server/pakasir";
import { addAuditLog, now, readDb, writeDb, type SubscriptionInvoice } from "@/lib/server/data-store";
import { fail, ok, readJson } from "@/lib/server/http";
import { PLAN_CONFIG, type BillingPeriod, type PaidSubscriptionPlan } from "@/lib/server/subscription";
import { paymentCredentials, protectPaymentConfig } from "@/lib/server/payment-secrets";

function isPaidPlan(value: unknown): value is PaidSubscriptionPlan {
  return value === "basic" || value === "starter" || value === "pro" || value === "business";
}

function isPeriod(value: unknown): value is BillingPeriod {
  return value === "monthly" || value === "yearly";
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const body = await readJson(request) as { planType?: unknown; billingPeriod?: unknown };
    if (!isPaidPlan(body.planType)) return fail("Paket subscription tidak valid.", 422);
    const billingPeriod = isPeriod(body.billingPeriod) ? body.billingPeriod : "yearly";
    const plan = PLAN_CONFIG[body.planType];
    const amount = billingPeriod === "yearly" ? plan.priceYearly : plan.priceMonthly;
    if (!amount) return fail("Paket ini hanya tersedia pembayaran tahunan.", 422);

    const db = await readDb();
    const config = db.paymentConfigs.find((row) => row.ownerId === scope.ownerId);
    if (config) protectPaymentConfig(config);
    const credentials = paymentCredentials(config);
    if (!credentials.pakasirSlug || !credentials.pakasirApiKey) return fail("Owner belum mengisi Slug/API Key Pakasir untuk pembayaran subscription.", 422);

    const duplicate = db.subscriptionInvoices
      .filter((row) => row.adminId === scope.adminId && row.planType === body.planType && row.billingPeriod === billingPeriod && row.status === "pending")
      .find((row) => !row.expiredAt || new Date(row.expiredAt).getTime() > Date.now());
    if (duplicate) {
      return ok({
        invoice: duplicate,
        payment: {
          paymentUrl: duplicate.paymentUrl,
          qrString: duplicate.qrString,
          qrImageDataUrl: duplicate.qrImageDataUrl,
          totalPayment: duplicate.totalPayment,
          fee: duplicate.fee,
          expiredAt: duplicate.expiredAt,
        },
        replayed: true,
      });
    }

    const t = now();
    const invoiceId = createId("subinv");
    const providerOrderId = invoiceId;
    const pakasir = await createPakasirQris({ slug: credentials.pakasirSlug, apiKey: credentials.pakasirApiKey, orderId: providerOrderId, amount });
    const invoice: SubscriptionInvoice = {
      id: invoiceId,
      ownerId: scope.ownerId,
      adminId: scope.adminId,
      planType: body.planType,
      billingPeriod,
      amount,
      provider: "pakasir",
      providerOrderId,
      status: "pending",
      paymentUrl: pakasir.paymentUrl,
      qrString: pakasir.qrString,
      qrImageDataUrl: pakasir.qrImageDataUrl,
      totalPayment: pakasir.totalPayment,
      fee: pakasir.fee,
      expiredAt: pakasir.expiredAt ?? null,
      paidAt: null,
      createdAt: t,
      updatedAt: t,
    };
    db.subscriptionInvoices.push(invoice);
    addAuditLog(db, {
      actorId: session.user.id,
      actorRole: "admin",
      shopId: scope.shopId,
      action: "create_subscription_invoice",
      entityType: "subscription_invoice",
      entityId: invoice.id,
      message: `Invoice subscription ${plan.label} dibuat senilai ${amount}.`,
      metadata: { planType: invoice.planType, billingPeriod, amount },
    });
    await writeDb(db);
    return ok({ invoice, payment: pakasir }, { status: 201 });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status >= 400 ? status : 400);
  }
}
