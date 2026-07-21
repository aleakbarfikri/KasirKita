import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { debtPaymentSchema } from "@/lib/server/validators";
import { addAuditLog, now, withDbTransaction } from "@/lib/server/data-store";
import { recordDebtPayment } from "@/lib/server/financial-ledger";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, props: Params) {
  const params = await props.params;
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const body = debtPaymentSchema.parse(await readJson(request));
    const result = await withDbTransaction((db) => {
      const legacyCashierIds = db.cashierProfiles
        .filter((profile) => profile.adminId === scope.adminId && profile.shopId === scope.shopId)
        .map((profile) => profile.userId);
      const visibleOwnerIds = new Set([scope.adminId, ...legacyCashierIds]);
      const debt = db.debts.find((row) => row.id === params.id && visibleOwnerIds.has(row.adminId) && row.shopId === scope.shopId);
      if (!debt) throw Object.assign(new Error("Debt not found"), { status: 404 });
      if (debt.status === "paid") throw Object.assign(new Error("Debt is already paid"), { status: 422 });

      const outstanding = Math.max(0, debt.amount - debt.paidAmount);
      const appliedAmount = Math.min(outstanding, body.amount);
      const payment = { id: createId("debtpay"), debtId: debt.id, amount: appliedAmount, note: body.note ?? null, createdAt: now() };
      debt.paidAmount += appliedAmount;
      debt.status = debt.paidAmount >= debt.amount ? "paid" : debt.paidAmount > 0 ? "partial" : "open";
      debt.updatedAt = now();
      db.debtPayments.push(payment);
      recordDebtPayment(db, {
        paymentId: payment.id,
        debtId: debt.id,
        amount: appliedAmount,
        ownerId: scope.ownerId,
        adminId: scope.adminId,
        shopId: scope.shopId,
      });
      addAuditLog(db, {
        actorId: session.user.id,
        actorRole: "admin",
        shopId: scope.shopId,
        action: "pay_debt",
        entityType: "debt",
        entityId: debt.id,
        message: `Pembayaran hutang ${debt.customerName} dicatat senilai ${appliedAmount}.`,
        metadata: { requestedAmount: body.amount, appliedAmount, status: debt.status },
      });
      return { payment, debt };
    });
    return ok(result);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Invalid debt payment payload", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
