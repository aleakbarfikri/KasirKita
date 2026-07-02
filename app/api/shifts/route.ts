import { authError, getAdminScope, requireAuth, requirePosUser } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { closeShiftSchema } from "@/lib/server/validators";
import { transactionProfit } from "@/lib/server/profit";
import { addAuditLog, createDataId, now, readDb, sortDesc, writeDb, type CashShift, type Transaction } from "@/lib/server/data-store";

function shiftRow(db: Awaited<ReturnType<typeof readDb>>, shift: CashShift) {
  return {
    ...shift,
    cashierName: db.users.find((user) => user.id === shift.cashierId)?.name,
    shopName: db.shops.find((shop) => shop.id === shift.shopId)?.name,
  };
}

function inRange(transaction: Transaction, openedAt: string, closedAt: string) {
  const created = new Date(transaction.createdAt).getTime();
  return created > new Date(openedAt).getTime() && created <= new Date(closedAt).getTime();
}

export async function GET() {
  try {
    const session = await requireAuth();
    const db = await readDb();

    if (session.user.role === "owner") {
      const ownerShopIds = new Set(db.shops.filter((shop) => shop.ownerId === session.user.id).map((shop) => shop.id));
      return ok(sortDesc(db.cashShifts.filter((shift) => ownerShopIds.has(shift.shopId)).map((shift) => shiftRow(db, shift))));
    }

    if (session.user.role === "admin" || session.user.role === "cashier") {
      const scope = await getAdminScope(session.user.id);
      const rows = db.cashShifts
        .filter((shift) => shift.shopId === scope.shopId && (session.user.role === "cashier" ? shift.cashierId === session.user.id : true))
        .map((shift) => shiftRow(db, shift));
      return ok(sortDesc(rows));
    }

    return fail("Unauthorized", 401);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePosUser();
    const scope = await getAdminScope(session.user.id);
    const body = closeShiftSchema.parse(await readJson(request));
    const db = await readDb();
    const previousShift = sortDesc(db.cashShifts.filter((shift) => shift.cashierId === session.user.id && shift.shopId === scope.shopId))[0];
    const openedAt = previousShift?.closedAt ?? new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const closedAt = now();
    const shiftTransactions = db.transactions.filter((transaction) =>
      transaction.shopId === scope.shopId &&
      transaction.cashierId === session.user.id &&
      inRange(transaction, openedAt, closedAt)
    );

    const successful = shiftTransactions.filter((transaction) => transaction.status === "success");
    const grossProfit = successful.reduce((sum, transaction) => sum + transactionProfit(db, transaction).grossProfit, 0);
    const cashSales = successful.filter((transaction) => transaction.paymentMethod === "cash").reduce((sum, transaction) => sum + transaction.total, 0);
    const qrisStaticSales = successful.filter((transaction) => transaction.paymentMethod === "qris_static").reduce((sum, transaction) => sum + transaction.total, 0);
    const qrisPakasirSales = successful.filter((transaction) => transaction.paymentMethod === "qris_pakasir").reduce((sum, transaction) => sum + transaction.total, 0);
    const debtSales = successful.filter((transaction) => transaction.paymentMethod === "debt").reduce((sum, transaction) => sum + transaction.total, 0);
    const cancelledSales = shiftTransactions.filter((transaction) => transaction.status === "cancelled").reduce((sum, transaction) => sum + transaction.total, 0);
    const cashCounted = body.cashCounted ?? null;

    const shift: CashShift = {
      id: createDataId("shift"),
      shopId: scope.shopId,
      cashierId: session.user.id,
      openedAt,
      closedAt,
      transactionCount: shiftTransactions.length,
      cashSales,
      qrisStaticSales,
      qrisPakasirSales,
      debtSales,
      cancelledSales,
      grossSales: successful.reduce((sum, transaction) => sum + transaction.total, 0),
      grossProfit,
      cashCounted,
      cashDifference: cashCounted === null ? null : cashCounted - cashSales,
      note: body.note ?? null,
      createdAt: closedAt,
    };

    db.cashShifts.push(shift);
    addAuditLog(db, {
      actorId: session.user.id,
      actorRole: session.user.role === "cashier" ? "cashier" : "admin",
      shopId: scope.shopId,
      action: "close_shift",
      entityType: "cash_shift",
      entityId: shift.id,
      message: `${session.user.name || session.user.username || "Kasir"} menutup shift dengan ${shift.transactionCount} transaksi.`,
      metadata: { grossSales: shift.grossSales, cashSales, cashDifference: shift.cashDifference },
    });

    await writeDb(db);
    return ok(shiftRow(db, shift), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Data tutup shift tidak valid.", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
