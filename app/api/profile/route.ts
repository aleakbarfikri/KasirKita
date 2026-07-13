import { authError, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { withDbTransaction } from "@/lib/server/data-store";
import { applyProfileUpdate, type ProfileUpdateInput } from "@/lib/server/profile-update";

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const body = await readJson<ProfileUpdateInput>(request);
    return ok(await withDbTransaction((db) => applyProfileUpdate(db, session.user.id, body)));
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status >= 400 ? status : 400);
  }
}
