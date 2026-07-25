import { authError, requireOwner } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { addAuditLog, incrementBalance, now, withDbTransaction } from "@/lib/server/data-store";
import { recordWithdrawalSettlement } from "@/lib/server/financial-ledger";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, props: Params) {
  const params = await props.params;
  try {
    const session = await requireOwner();
    const withdrawal = await withDbTransaction((db) => {
      const current = db.withdrawals.find((row) => row.id === params.id && row.ownerId === session.user.id);
      if (!current) throw Object.assign(new Error("Withdrawal not found"), { status: 404 });
      if (current.status === "completed") return current;

      const t = now();
      current.status = "completed";
      current.completedAt = t;
      current.processedAt = current.processedAt ?? t;
      incrementBalance(db, current.adminId, "totalWithdrawn", current.amount);
      recordWithdrawalSettlement(db, {
        withdrawalId: current.id,
        amount: current.amount,
        ownerId: current.ownerId,
        adminId: current.adminId,
      });
      addAuditLog(db, {
        actorId: session.user.id,
        actorRole: "owner",
        action: "complete_withdrawal",
        entityType: "withdrawal",
        entityId: current.id,
        message: `Owner menyelesaikan penarikan ${current.id} senilai ${current.amount}.`,
        metadata: { adminId: current.adminId, amount: current.amount },
      });
      return current;
    });
    return ok(withdrawal);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
