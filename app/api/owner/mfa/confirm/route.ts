import { authError, requireAuth } from "@/lib/server/auth-guard";
import { readJson, fail, ok } from "@/lib/server/http";
import { now, withDbTransaction } from "@/lib/server/data-store";
import { enableMfa, generateRecoveryCodes, verifyOwnerMfaCode } from "@/lib/server/mfa";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "owner" && session.user.role !== "admin") return fail("MFA hanya tersedia untuk Owner dan Admin.", 403);
    const limit = await enforceRateLimit(request, "owner:mfa:confirm", { limit: 8, windowMs: 15 * 60 * 1000 }, session.user.id);
    if (!limit.allowed) return fail("Terlalu banyak kode salah. Coba lagi beberapa menit.", 429);
    const body = await readJson<{ code?: string }>(request);
    const recoveryCodes = generateRecoveryCodes();
    await withDbTransaction((db) => {
      const config = db.ownerMfaConfigs.find((row) => row.ownerId === session.user.id && !row.enabled);
      if (!config) throw Object.assign(new Error("Setup MFA belum dimulai."), { status: 404 });
      if (!verifyOwnerMfaCode(config, String(body.code || "")).valid) throw Object.assign(new Error("Kode authenticator tidak valid."), { status: 401 });
      enableMfa(config, recoveryCodes, now());
    });
    return ok({ enabled: true, recoveryCodes });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
