import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { debtCreateSchema } from "@/lib/server/validators";
import { now, readDb, sortDesc, writeDb, type Debt } from "@/lib/server/data-store";

export async function GET() {
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const db = await readDb();
    const legacyCashierIds = db.cashierProfiles
      .filter((profile) => profile.adminId === scope.adminId && profile.shopId === scope.shopId)
      .map((profile) => profile.userId);
    const visibleOwnerIds = new Set([scope.adminId, ...legacyCashierIds]);
    const rows = db.debts.filter((debt) => visibleOwnerIds.has(debt.adminId) && debt.shopId === scope.shopId);
    return ok(sortDesc(rows));
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const body = debtCreateSchema.parse(await readJson(request));
    const t = now();
    const created: Debt = {
      id: createId("debt"),
      shopId: scope.shopId,
      adminId: scope.adminId,
      transactionId: null,
      customerName: body.customerName,
      customerPhone: body.customerPhone ?? null,
      amount: body.amount,
      paidAmount: 0,
      status: "open",
      dueDate: body.dueDate ? new Date(body.dueDate).toISOString() : null,
      note: body.note ?? null,
      createdAt: t,
      updatedAt: t,
    };
    const db = await readDb();
    db.debts.push(created);
    await writeDb(db);
    return ok(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Invalid debt payload", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
