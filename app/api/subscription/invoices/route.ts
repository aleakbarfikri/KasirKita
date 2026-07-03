import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { readDb, sortDesc } from "@/lib/server/data-store";
import { fail, ok } from "@/lib/server/http";

export async function GET() {
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const db = await readDb();
    const rows = sortDesc(db.subscriptionInvoices.filter((invoice) => invoice.adminId === scope.adminId));
    return ok(rows);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
