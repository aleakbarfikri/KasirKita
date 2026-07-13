import { hashPassword, now, verifyPassword, type AppDb } from "@/lib/server/data-store";

type ResetResult = { ok: true } | { ok: false; message: string; status: number };

export function applyPasswordReset(db: AppDb, input: { email: string; verificationCode: string; password: string }): ResetResult {
  const email = input.email.trim().toLowerCase();
  const user = db.users.find((row) => row.email.toLowerCase() === email);
  const verification = [...db.emailVerifications]
    .reverse()
    .find((row) => row.email.toLowerCase() === email && row.purpose === "password_reset" && !row.consumedAt);

  if (!user || !verification) return { ok: false, message: "Kode pemulihan tidak valid atau sudah digunakan.", status: 422 };
  if (new Date(verification.expiresAt).getTime() <= Date.now()) {
    return { ok: false, message: "Kode pemulihan sudah kedaluwarsa.", status: 422 };
  }
  if (verification.attempts >= 5) return { ok: false, message: "Kode terlalu sering salah. Minta kode baru.", status: 429 };
  if (!verifyPassword(input.verificationCode, verification.codeHash)) {
    verification.attempts += 1;
    return { ok: false, message: "Kode pemulihan salah.", status: 422 };
  }

  const timestamp = now();
  user.passwordHash = hashPassword(input.password);
  user.updatedAt = timestamp;
  verification.consumedAt = timestamp;
  db.sessions = db.sessions.filter((row) => row.userId !== user.id);
  return { ok: true };
}
