import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { sortDesc, withDbTransaction } from "@/lib/server/data-store";
import { fail, ok } from "@/lib/server/http";
import { maintainSubscriptionInvoices } from "@/lib/server/subscription-invoice-retention";

export async function GET() {
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const rows = await withDbTransaction((db) => {
      maintainSubscriptionInvoices(db);
      return sortDesc(db.subscriptionInvoices.filter((invoice) => invoice.adminId === scope.adminId));
    });
    return ok(rows);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
