import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { debtPaymentSchema } from "@/lib/server/validators";
import { now, readDb, writeDb } from "@/lib/server/data-store";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const body = debtPaymentSchema.parse(await readJson(request));
    const db = readDb();
    const debt = db.debts.find((row) => row.id === params.id && row.adminId === session.user.id && row.shopId === scope.shopId);
    if (!debt) return fail("Debt not found", 404);
    if (debt.status === "paid") return fail("Debt is already paid", 422);

    const payment = { id: createId("debtpay"), debtId: debt.id, amount: body.amount, note: body.note ?? null, createdAt: now() };
    const nextPaid = Math.min(debt.amount, debt.paidAmount + body.amount);
    debt.paidAmount = nextPaid;
    debt.status = nextPaid >= debt.amount ? "paid" : nextPaid > 0 ? "partial" : "open";
    debt.updatedAt = now();
    db.debtPayments.push(payment);
    writeDb(db);
    return ok({ payment, debt });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Invalid debt payment payload", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
