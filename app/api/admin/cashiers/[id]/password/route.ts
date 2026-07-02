import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { rowWithCashierProfile } from "@/lib/server/cashier-helpers";
import { hashPassword, now, readDb, writeDb } from "@/lib/server/data-store";
import { fail, ok, readJson } from "@/lib/server/http";
import { cashierPasswordSchema } from "@/lib/server/validators";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const body = cashierPasswordSchema.parse(await readJson(request));
    const db = await readDb();
    const profile = db.cashierProfiles.find((row) => row.userId === params.id && row.adminId === session.user.id && row.shopId === scope.shopId);
    if (!profile) return fail("Kasir tidak ditemukan untuk admin ini.", 404);

    const cashier = db.users.find((user) => user.id === profile.userId && user.role === "cashier");
    if (!cashier) return fail("Akun kasir tidak ditemukan.", 404);

    cashier.passwordHash = hashPassword(body.password);
    cashier.updatedAt = now();
    profile.updatedAt = now();
    await writeDb(db);

    const row = rowWithCashierProfile(db, profile);
    return ok(row);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return fail("Password kasir minimal 8 karakter.", 422, error);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
