import crypto from "node:crypto";
import { requireAuth, authError } from "@/lib/server/auth-guard";
import { hashPassword, now, readDb, verifyPassword, writeDb } from "@/lib/server/data-store";
import { sendEmailChangeCodeEmail } from "@/lib/server/email";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const limit = await enforceRateLimit(request, "profile:email-change", { limit: 5, windowMs: 15 * 60 * 1000 }, session.user.id);
    if (!limit.allowed) return fail("Terlalu banyak permintaan kode. Coba lagi beberapa menit.", 429);
    const body = await readJson<{ email?: string; currentPassword?: string }>(request);
    const email = String(body.email || "").trim().toLowerCase();
    const db = await readDb();
    const user = db.users.find((row) => row.id === session.user.id);
    if (!user || !verifyPassword(String(body.currentPassword || ""), user.passwordHash)) return fail("Password saat ini salah.", 401);
    if (!/^\S+@\S+\.\S+$/.test(email) || email === user.email.toLowerCase()) return fail("Masukkan email baru yang valid.", 422);
    if (db.users.some((row) => row.id !== user.id && row.email.toLowerCase() === email)) return fail("Email sudah digunakan akun lain.", 409);
    const code = String(crypto.randomInt(100000, 1000000));
    await sendEmailChangeCodeEmail({ to: email, code });
    db.emailVerifications = db.emailVerifications.filter((row) => !(row.userId === user.id && row.purpose === "email_change" && !row.consumedAt));
    db.emailVerifications.push({ id: createId("verify"), userId: user.id, email, codeHash: hashPassword(code), purpose: "email_change", attempts: 0, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), consumedAt: null, createdAt: now() });
    await writeDb(db);
    return ok({ sent: true });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
