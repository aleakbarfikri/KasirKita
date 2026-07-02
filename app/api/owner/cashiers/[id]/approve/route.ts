import { authError, requireOwner } from "@/lib/server/auth-guard";
import { rowWithCashierProfile } from "@/lib/server/cashier-helpers";
import { now, readDb, writeDb } from "@/lib/server/data-store";
import { fail, ok } from "@/lib/server/http";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireOwner();
    const db = await readDb();
    const profile = db.cashierProfiles.find((row) => row.userId === params.id && row.ownerId === session.user.id);
    if (!profile) return fail("Kasir tidak ditemukan untuk owner ini.", 404);

    profile.approvalStatus = "approved";
    profile.isActive = true;
    profile.updatedAt = now();
    await writeDb(db);

    const row = rowWithCashierProfile(db, profile);
    return ok(row);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
