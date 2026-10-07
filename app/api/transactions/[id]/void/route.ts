import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { restoreSuccessfulTransactionStock } from "@/lib/server/inventory";
import { voidTransactionSchema } from "@/lib/server/validators";
import { addAuditLog, incrementBalance, now, withDbTransaction } from "@/lib/server/data-store";
import { recordTransactionVoid } from "@/lib/server/financial-ledger";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, props: Params) {
  const params = await props.params;
  try {
    const session = await requireAuth();
    const body = voidTransactionSchema.parse(await readJson(request));
    const scope = session.user.role === "admin" || session.user.role === "cashier" ? await getAdminScope(session.user.id) : null;
    const result = await withDbTransaction((db) => {
      const transaction = db.transactions.find((row) => row.id === params.id);
      if (!transaction) throw Object.assign(new Error("Transaksi tidak ditemukan."), { status: 404 });

      let actorRole: "owner" | "admin" | "cashier";
      let shopId = transaction.shopId;
      let adminIdForBalance: string | null = null;
      let ownerIdForLedger: string | null = null;

      if (session.user.role === "owner") {
        const shop = db.shops.find((row) => row.id === transaction.shopId && row.ownerId === session.user.id);
        if (!shop) throw Object.assign(new Error("Transaksi tidak ditemukan untuk Owner ini."), { status: 404 });
        const adminProfile = db.adminProfiles.find((profile) => profile.shopId === shop.id);
        adminIdForBalance = adminProfile?.userId ?? null;
        ownerIdForLedger = shop.ownerId;
        actorRole = "owner";
      } else if (session.user.role === "admin" || session.user.role === "cashier") {
        shopId = scope!.shopId;
        adminIdForBalance = scope!.adminId;
        ownerIdForLedger = scope!.ownerId;
        if (transaction.shopId !== scope!.shopId) throw Object.assign(new Error("Transaksi tidak ditemukan untuk toko ini."), { status: 404 });
        if (session.user.role === "cashier" && transaction.cashierId !== session.user.id) {
          throw Object.assign(new Error("Kasir hanya bisa membatalkan transaksi miliknya sendiri."), { status: 403 });
        }
        actorRole = session.user.role;
      } else {
        throw Object.assign(new Error("Unauthorized"), { status: 401 });
      }

      if (transaction.status !== "success") throw Object.assign(new Error("Hanya transaksi sukses yang bisa di-void."), { status: 422 });

      const items = db.transactionItems.filter((item) => item.transactionId === transaction.id);
      restoreSuccessfulTransactionStock(db, transaction.shopId, items);

      transaction.status = "cancelled";
      transaction.note = [transaction.note, `VOID: ${body.reason}`].filter(Boolean).join(" | ");
      transaction.updatedAt = now();

      if (transaction.paymentMethod === "qris_pakasir" && adminIdForBalance) {
        incrementBalance(db, adminIdForBalance, "totalEarnedQrisApi", -transaction.total);
      }
      recordTransactionVoid(db, transaction, { ownerId: ownerIdForLedger, adminId: adminIdForBalance });

      const debt = db.debts.find((row) => row.transactionId === transaction.id && row.status !== "paid");
      if (debt) {
        debt.status = "paid";
        debt.paidAmount = debt.amount;
        debt.note = [debt.note, `Ditutup karena transaksi di-void: ${body.reason}`].filter(Boolean).join(" | ");
        debt.updatedAt = now();
      }

      addAuditLog(db, {
        actorId: session.user.id,
        actorRole,
        shopId,
        action: "void_transaction",
        entityType: "transaction",
        entityId: transaction.id,
        message: `${session.user.name || session.user.username || "User"} membatalkan transaksi ${transaction.id}.`,
        metadata: { reason: body.reason, total: transaction.total, paymentMethod: transaction.paymentMethod },
      });

      return { transaction, items, debt: debt ?? null };
    });
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Alasan void wajib diisi minimal 3 karakter.", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
