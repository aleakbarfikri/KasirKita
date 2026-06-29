import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { withdrawalRequestSchema } from "@/lib/server/validators";
import { getBalanceFromDb, now, readDb, sortDesc, verifyPassword, writeDb, type Withdrawal } from "@/lib/server/data-store";

export async function GET() {
  try {
    const session = await requireAdmin();
    const rows = readDb().withdrawals.filter((row) => row.adminId === session.user.id);
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
    const body = withdrawalRequestSchema.parse(await readJson(request));
    const db = readDb();
    const admin = db.users.find((user) => user.id === session.user.id);
    if (!admin || !verifyPassword(body.adminPassword, admin.passwordHash)) return fail("Password admin salah. Penarikan dibatalkan.", 401);

    const balance = getBalanceFromDb(db, session.user.id);
    const reserved = db.withdrawals
      .filter((row) => row.adminId === session.user.id && (row.status === "pending" || row.status === "processed"))
      .reduce((sum, row) => sum + row.amount, 0);
    const available = (balance?.totalEarnedQrisApi ?? 0) - (balance?.totalWithdrawn ?? 0) - reserved;
    if (body.amount > available) return fail(`Withdrawal amount exceeds available balance. Available: ${available}`, 422);

    const created: Withdrawal = {
      id: createId("wd"),
      adminId: session.user.id,
      ownerId: scope.ownerId,
      amount: body.amount,
      bankName: body.bankName,
      accountNumber: body.accountNumber,
      accountName: body.accountName,
      status: "pending",
      createdAt: now(),
      processedAt: null,
      completedAt: null,
    };
    db.withdrawals.push(created);
    writeDb(db);
    return ok(created, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Data penarikan belum lengkap. Isi rekening, nominal, dan password admin.", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
