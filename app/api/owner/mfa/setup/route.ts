import QRCode from "qrcode";
import { authError, requireAuth } from "@/lib/server/auth-guard";
import { readJson, fail, ok } from "@/lib/server/http";
import { now, verifyPassword, withDbTransaction } from "@/lib/server/data-store";
import { createPendingMfaConfig, generateTotpSecret, totpProvisioningUri } from "@/lib/server/mfa";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "owner" && session.user.role !== "admin") return fail("MFA hanya tersedia untuk Owner dan Admin.", 403);
    const limit = await enforceRateLimit(request, "owner:mfa:setup", { limit: 5, windowMs: 15 * 60 * 1000 }, session.user.id);
    if (!limit.allowed) return fail("Terlalu banyak percobaan. Coba lagi beberapa menit.", 429);
    const body = await readJson<{ currentPassword?: string }>(request);
    const secret = generateTotpSecret();
    await withDbTransaction((db) => {
      const owner = db.users.find((row) => row.id === session.user.id && (row.role === "owner" || row.role === "admin"));
      if (!owner) throw Object.assign(new Error("Akun tidak ditemukan."), { status: 404 });
      if (!verifyPassword(String(body.currentPassword || ""), owner.passwordHash)) throw Object.assign(new Error("Password akun salah."), { status: 401 });
      if (db.ownerMfaConfigs.some((row) => row.ownerId === owner.id && row.enabled)) throw Object.assign(new Error("MFA akun sudah aktif."), { status: 409 });
      db.ownerMfaConfigs = db.ownerMfaConfigs.filter((row) => row.ownerId !== owner.id);
      db.ownerMfaConfigs.push(createPendingMfaConfig(owner.id, secret, now()));
    });
    const uri = totpProvisioningUri(secret, session.user.username || session.user.email);
    const qrImageDataUrl = await QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 2, width: 320 });
    return ok({ secret, uri, qrImageDataUrl });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
