import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { getPakasirTransactionStatus } from "@/lib/server/pakasir";
import { confirmSubscriptionPayment } from "@/lib/server/payment-confirmation";
import { readDb, withDbTransaction } from "@/lib/server/data-store";
import { fail, ok } from "@/lib/server/http";
import { paymentCredentials } from "@/lib/server/payment-secrets";

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
    const credentials = paymentCredentials(config);
    if (!credentials.pakasirSlug || !credentials.pakasirApiKey) return fail("Owner belum mengisi Slug/API Key Pakasir.", 422);

    const pakasir = await getPakasirTransactionStatus({
      slug: credentials.pakasirSlug,
      apiKey: credentials.pakasirApiKey,
      orderId: invoice.providerOrderId,
      amount: invoice.amount,
    });

    if (pakasir.isPaid) {
      const confirmed = await withDbTransaction((currentDb) => confirmSubscriptionPayment(currentDb, {
        invoiceId: params.id,
        adminId: scope.adminId,
        shopId: scope.shopId,
        actorId: session.user.id,
        providerStatus: pakasir.status,
      }));
      return ok({
        invoice: confirmed.invoice,
        status: confirmed.invoice.status,
        profile: confirmed.profile,
        providerStatus: pakasir.status,
        replayed: !confirmed.applied,
      });
    }

    return ok({ invoice, status: "pending", providerStatus: pakasir.status });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status >= 400 ? status : 400);
  }
}
