import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { debtPaymentSchema } from "@/lib/server/validators";
import { addAuditLog, now, readDb, writeDb } from "@/lib/server/data-store";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const body = debtPaymentSchema.parse(await readJson(request));
    const db = await readDb();
    const legacyCashierIds = db.cashierProfiles
      .filter((profile) => profile.adminId === scope.adminId && profile.shopId === scope.shopId)
      .map((profile) => profile.userId);
    const visibleOwnerIds = new Set([scope.adminId, ...legacyCashierIds]);
    const debt = db.debts.find((row) => row.id === params.id && visibleOwnerIds.has(row.adminId) && row.shopId === scope.shopId);
    if (!debt) return fail("Debt not found", 404);
    if (debt.status === "paid") return fail("Debt is already paid", 422);

    const payment = { id: createId("debtpay"), debtId: debt.id, amount: body.amount, note: body.note ?? null, createdAt: now() };
    const nextPaid = Math.min(debt.amount, debt.paidAmount + body.amount);
    debt.paidAmount = nextPaid;
    debt.status = nextPaid >= debt.amount ? "paid" : nextPaid > 0 ? "partial" : "open";
    debt.updatedAt = now();
    db.debtPayments.push(payment);
    addAuditLog(db, {
      actorId: session.user.id,
      actorRole: "admin",
      shopId: scope.shopId,
      action: "pay_debt",
      entityType: "debt",
      entityId: debt.id,
      message: `Pembayaran hutang ${debt.customerName} dicatat senilai ${body.amount}.`,
      metadata: { amount: body.amount, status: debt.status },
    });
    await writeDb(db);
    return ok({ payment, debt });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Invalid debt payment payload", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
