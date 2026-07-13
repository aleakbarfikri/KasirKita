import { withDbTransaction } from "@/lib/server/data-store";
import { fail, ok, readJson } from "@/lib/server/http";
import { applyPasswordReset } from "@/lib/server/password-reset";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { passwordResetConfirmSchema } from "@/lib/server/validators";

export async function POST(request: Request) {
  try {
    const parsed = passwordResetConfirmSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(parsed.error.issues.map((issue) => issue.message).join(". "), 422);
    const body = parsed.data;
    const limit = await enforceRateLimit(request, "password-reset:confirm", { limit: 8, windowMs: 15 * 60 * 1000 }, body.email);
    if (!limit.allowed) return fail("Terlalu banyak percobaan. Minta kode baru.", 429);
    const result = await withDbTransaction((db) => applyPasswordReset(db, body));
    if (!result.ok) return fail(result.message, result.status);
    return ok({ reset: true });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status: unknown }).status) : 400;
    return fail(error instanceof Error ? error.message : "Gagal membuat password baru.", status);
  }
}
