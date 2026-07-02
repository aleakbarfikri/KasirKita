import { authError, requireOwner } from "@/lib/server/auth-guard";
import { rowWithCashierProfile } from "@/lib/server/cashier-helpers";
import { readDb } from "@/lib/server/data-store";
import { fail, ok } from "@/lib/server/http";

export async function GET() {
  try {
    const session = await requireOwner();
    const db = await readDb();
    const rows = db.cashierProfiles
      .filter((profile) => profile.ownerId === session.user.id)
      .map((profile) => rowWithCashierProfile(db, profile))
      .filter(Boolean);
    return ok((rows as NonNullable<ReturnType<typeof rowWithCashierProfile>>[]).sort((a, b) => b.profile.createdAt.localeCompare(a.profile.createdAt)));
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
