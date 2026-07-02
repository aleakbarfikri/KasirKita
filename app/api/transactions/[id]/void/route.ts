import { authError, getAdminScope, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { restoreSuccessfulTransactionStock } from "@/lib/server/inventory";
import { voidTransactionSchema } from "@/lib/server/validators";
import { addAuditLog, incrementBalance, now, readDb, writeDb } from "@/lib/server/data-store";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireAuth();
    const body = voidTransactionSchema.parse(await readJson(request));
    const db = await readDb();
    const transaction = db.transactions.find((row) => row.id === params.id);
    if (!transaction) return fail("Transaksi tidak ditemukan.", 404);

    let actorRole: "owner" | "admin" | "cashier";
    let shopId = transaction.shopId;
    let adminIdForBalance: string | null = null;

    if (session.user.role === "owner") {
      const shop = db.shops.find((row) => row.id === transaction.shopId && row.ownerId === session.user.id);
      if (!shop) return fail("Transaksi tidak ditemukan untuk Owner ini.", 404);
      const adminProfile = db.adminProfiles.find((profile) => profile.shopId === shop.id);
      adminIdForBalance = adminProfile?.userId ?? null;
      actorRole = "owner";
    } else if (session.user.role === "admin" || session.user.role === "cashier") {
      const scope = await getAdminScope(session.user.id);
      shopId = scope.shopId;
      adminIdForBalance = scope.adminId;
      if (transaction.shopId !== scope.shopId) return fail("Transaksi tidak ditemukan untuk toko ini.", 404);
      if (session.user.role === "cashier" && transaction.cashierId !== session.user.id) {
        return fail("Kasir hanya bisa membatalkan transaksi miliknya sendiri.", 403);
      }
      actorRole = session.user.role;
    } else {
      return fail("Unauthorized", 401);
    }

    if (transaction.status !== "success") return fail("Hanya transaksi sukses yang bisa di-void.", 422);

    const items = db.transactionItems.filter((item) => item.transactionId === transaction.id);
    restoreSuccessfulTransactionStock(db, transaction.shopId, items);

    transaction.status = "cancelled";
    transaction.note = [transaction.note, `VOID: ${body.reason}`].filter(Boolean).join(" | ");
    transaction.updatedAt = now();

    if (transaction.paymentMethod === "qris_pakasir" && adminIdForBalance) {
      incrementBalance(db, adminIdForBalance, "totalEarnedQrisApi", -transaction.total);
    }

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

    await writeDb(db);
    return ok({ transaction, items, debt: debt ?? null });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Alasan void wajib diisi minimal 3 karakter.", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
