import { authError, requireAuth } from "@/lib/server/auth-guard";
import { readJson, fail, ok } from "@/lib/server/http";
import { revokeUserSessions, verifyPassword, withDbTransaction } from "@/lib/server/data-store";
import { verifyOwnerMfaCode } from "@/lib/server/mfa";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export async function GET() {
  try {
    const session = await requireAuth();
    if (session.user.role !== "owner" && session.user.role !== "admin") return fail("MFA hanya tersedia untuk Owner dan Admin.", 403);
    const status = await withDbTransaction((db) => {
      const config = db.ownerMfaConfigs.find((row) => row.ownerId === session.user.id);
      return { enabled: Boolean(config?.enabled), recoveryCodesRemaining: config?.enabled ? config.recoveryCodeHashes.length : 0 };
    });
    return ok(status);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "owner" && session.user.role !== "admin") return fail("MFA hanya tersedia untuk Owner dan Admin.", 403);
    const limit = await enforceRateLimit(request, "owner:mfa:disable", { limit: 5, windowMs: 15 * 60 * 1000 }, session.user.id);
    if (!limit.allowed) return fail("Terlalu banyak percobaan. Coba lagi beberapa menit.", 429);
    const body = await readJson<{ currentPassword?: string; code?: string }>(request);
    await withDbTransaction((db) => {
      const owner = db.users.find((row) => row.id === session.user.id && (row.role === "owner" || row.role === "admin"));
      const config = db.ownerMfaConfigs.find((row) => row.ownerId === session.user.id && row.enabled);
      if (!owner || !config) throw Object.assign(new Error("MFA akun belum aktif."), { status: 404 });
      if (!verifyPassword(String(body.currentPassword || ""), owner.passwordHash)) throw Object.assign(new Error("Password akun salah."), { status: 401 });
      if (!verifyOwnerMfaCode(config, String(body.code || "")).valid) throw Object.assign(new Error("Kode MFA atau recovery code tidak valid."), { status: 401 });
      db.ownerMfaConfigs = db.ownerMfaConfigs.filter((row) => row.ownerId !== session.user.id);
      revokeUserSessions(db, session.user.id);
    });
    return ok({ disabled: true, signedOut: true });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
