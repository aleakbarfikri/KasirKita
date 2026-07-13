import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { getPakasirTransactionStatus } from "@/lib/server/pakasir";
import { addAuditLog, now, readDb, writeDb } from "@/lib/server/data-store";
import { fail, ok } from "@/lib/server/http";
import { applyPaidSubscription } from "@/lib/server/subscription";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, props: Params) {
  const params = await props.params;
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const db = await readDb();
    const invoice = db.subscriptionInvoices.find((row) => row.id === params.id && row.adminId === scope.adminId);
    if (!invoice) return fail("Invoice subscription tidak ditemukan.", 404);
    if (invoice.status === "paid") return ok({ invoice, status: "paid" });

    const config = db.paymentConfigs.find((row) => row.ownerId === scope.ownerId);
    if (!config?.pakasirSlug || !config?.pakasirApiKey) return fail("Owner belum mengisi Slug/API Key Pakasir.", 422);

    const pakasir = await getPakasirTransactionStatus({
      slug: config.pakasirSlug,
      apiKey: config.pakasirApiKey,
      orderId: invoice.providerOrderId,
      amount: invoice.amount,
    });

    if (pakasir.isPaid) {
      const profile = db.adminProfiles.find((row) => row.userId === scope.adminId);
      if (!profile) return fail("Profil admin tidak ditemukan.", 404);
      applyPaidSubscription(profile, invoice.planType, invoice.billingPeriod);
      invoice.status = "paid";
      invoice.paidAt = now();
      invoice.updatedAt = now();
      addAuditLog(db, {
        actorId: session.user.id,
        actorRole: "admin",
        shopId: scope.shopId,
        action: "confirm_subscription_payment",
        entityType: "subscription_invoice",
        entityId: invoice.id,
        message: `Pembayaran subscription ${invoice.planType} sukses. Masa aktif diperpanjang sampai ${profile.activeUntil || "tanpa batas"}.`,
        metadata: { planType: invoice.planType, billingPeriod: invoice.billingPeriod, amount: invoice.amount, activeUntil: profile.activeUntil },
      });
      await writeDb(db);
      return ok({ invoice, status: "paid", profile, providerStatus: pakasir.status });
    }

    return ok({ invoice, status: "pending", providerStatus: pakasir.status });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status >= 400 ? status : 400);
  }
}
