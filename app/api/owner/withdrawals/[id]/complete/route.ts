import { authError, requireOwner } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { incrementBalance, now, readDb, writeDb } from "@/lib/server/data-store";

type Params = { params: { id: string } };

export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await requireOwner();
    const db = readDb();
    const withdrawal = db.withdrawals.find((row) => row.id === params.id && row.ownerId === session.user.id);
    if (!withdrawal) return fail("Withdrawal not found", 404);
    if (withdrawal.status === "completed") return ok(withdrawal);

    const t = now();
    withdrawal.status = "completed";
    withdrawal.completedAt = t;
    withdrawal.processedAt = withdrawal.processedAt ?? t;
    incrementBalance(db, withdrawal.adminId, "totalWithdrawn", withdrawal.amount);
    writeDb(db);
    return ok(withdrawal);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
