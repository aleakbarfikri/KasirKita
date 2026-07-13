import { authError, getAdminScope, requirePosUser } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { getPakasirTransactionStatus } from "@/lib/server/pakasir";
import { confirmQrisPayment } from "@/lib/server/payment-confirmation";
import { readDb, withDbTransaction } from "@/lib/server/data-store";

type Params = { params: Promise<{ reference: string }> };

export async function GET(_request: Request, props: Params) {
  const params = await props.params;
  try {
    const session = await requirePosUser();
    const scope = await getAdminScope(session.user.id);
    const db = await readDb();
    const transaction = db.transactions.find((row) => row.externalRef === params.reference);
    if (!transaction || transaction.cashierId !== session.user.id) return fail("Payment reference not found", 404);

    if (transaction.status === "success") return ok({ status: "paid", providerStatus: "success", transaction });
    if (transaction.status === "failed" || transaction.status === "cancelled") return ok({ status: transaction.status, providerStatus: transaction.status, transaction });

    const config = db.paymentConfigs.find((row) => row.ownerId === scope.ownerId);
    if (!config?.pakasirSlug || !config?.pakasirApiKey) return fail("Slug dan API Key Pakasir belum dikonfigurasi.", 422);

    let providerStatus = "pending";
    let isPaid = false;
    try {
      const pakasir = await getPakasirTransactionStatus({ slug: config.pakasirSlug, apiKey: config.pakasirApiKey, orderId: transaction.id, amount: transaction.total });
      providerStatus = pakasir.status;
      isPaid = pakasir.isPaid;
    } catch (error) {
      return ok({ status: "pending", providerStatus: "pending", warning: error instanceof Error ? error.message : "Belum bisa cek status Pakasir", transaction });
    }

    if (isPaid) {
      const confirmed = await withDbTransaction((currentDb) => confirmQrisPayment(currentDb, {
        reference: params.reference,
        cashierId: session.user.id,
        adminId: scope.adminId,
        shopId: scope.shopId,
        actorRole: session.user.role === "cashier" ? "cashier" : "admin",
        providerStatus,
      }));
      if (confirmed.transaction.status !== "success") {
        return ok({ status: confirmed.transaction.status, providerStatus, transaction: confirmed.transaction });
      }
      return ok({
        status: "paid",
        providerStatus,
        transaction: confirmed.transaction,
        replayed: !confirmed.applied,
      });
    }

    return ok({ status: "pending", providerStatus, transaction });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
