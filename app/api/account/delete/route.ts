import { cookies } from "next/headers";
import { deleteAccountData } from "@/lib/server/account-deletion";
import { authError, requireAuth } from "@/lib/server/auth-guard";
import { verifyPassword, withDbTransaction } from "@/lib/server/data-store";
import { fail, ok, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const limit = await enforceRateLimit(request, "account:delete", { limit: 3, windowMs: 60 * 60 * 1000 }, session.user.id);
    if (!limit.allowed) return fail("Terlalu banyak percobaan. Coba lagi nanti.", 429);
    const body = await readJson<{ password?: string; confirmation?: string }>(request);
    if (String(body.confirmation || "").trim().toUpperCase() !== "HAPUS") return fail("Ketik HAPUS untuk mengonfirmasi.", 422);

    const result = await withDbTransaction((db) => {
      const user = db.users.find((row) => row.id === session.user.id);
      if (!user || !verifyPassword(String(body.password || ""), user.passwordHash)) {
        throw Object.assign(new Error("Password tidak benar."), { status: 401 });
      }
      return deleteAccountData(db, user.id);
    });
    (await cookies()).delete("kasirkita_session");
    return ok({ deleted: true, result });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
