import { authError, requireOwner } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { publicUser, readDb, sortDesc } from "@/lib/server/data-store";

export async function GET() {
  try {
    const session = await requireOwner();
    const db = await readDb();
    const rows = db.withdrawals
      .filter((withdrawal) => withdrawal.ownerId === session.user.id)
      .map((withdrawal) => {
        const admin = db.users.find((user) => user.id === withdrawal.adminId);
        return admin ? { withdrawal, admin: publicUser(admin) } : null;
      })
      .filter(Boolean) as Array<{ withdrawal: any; admin: any }>;
    return ok(sortDesc(rows.map((row) => ({ ...row, createdAt: row.withdrawal.createdAt })) as any[]).map(({ createdAt, ...row }) => row));
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
