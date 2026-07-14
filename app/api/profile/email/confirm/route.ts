import { requireAuth, authError } from "@/lib/server/auth-guard";
import { withDbTransaction } from "@/lib/server/data-store";
import { confirmEmailChange } from "@/lib/server/email-change";
import { fail, ok, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await readJson<{ email?: string; code?: string; currentPassword?: string }>(request);
    const result = await withDbTransaction((db) => confirmEmailChange(db, session.user.id, { email: String(body.email || ""), code: String(body.code || ""), currentPassword: String(body.currentPassword || "") }));
    if (!result.ok) return fail(result.message, result.status);
    return ok({ user: result.user });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
