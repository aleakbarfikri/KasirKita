import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { getPakasirTransactionStatus } from "@/lib/server/pakasir";
import { incrementBalance, now, readDb, writeDb } from "@/lib/server/data-store";

type Params = { params: { reference: string } };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const db = readDb();
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
      transaction.status = "success";
      transaction.updatedAt = now();
      incrementBalance(db, transaction.cashierId, "totalEarnedQrisApi", transaction.total);
      writeDb(db);
      return ok({ status: "paid", providerStatus, transaction });
    }

    return ok({ status: "pending", providerStatus, transaction });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
