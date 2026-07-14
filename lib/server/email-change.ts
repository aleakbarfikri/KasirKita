import { now, publicUser, verifyPassword, type AppDb } from "@/lib/server/data-store";

export function confirmEmailChange(db: AppDb, userId: string, input: { email: string; code: string; currentPassword: string }) {
  const user = db.users.find((row) => row.id === userId);
  if (!user) return { ok: false as const, status: 404, message: "Akun tidak ditemukan." };
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false as const, status: 422, message: "Email tidak valid." };
  if (!verifyPassword(input.currentPassword, user.passwordHash)) return { ok: false as const, status: 401, message: "Password saat ini salah." };
  if (db.users.some((row) => row.id !== userId && row.email.toLowerCase() === email)) return { ok: false as const, status: 409, message: "Email sudah digunakan akun lain." };
  const verification = [...db.emailVerifications].reverse().find((row) => row.userId === userId && row.email === email && row.purpose === "email_change" && !row.consumedAt);
  if (!verification || new Date(verification.expiresAt).getTime() <= Date.now() || verification.attempts >= 5) return { ok: false as const, status: 422, message: "Kode verifikasi tidak tersedia atau sudah kedaluwarsa." };
  if (!verifyPassword(input.code.trim(), verification.codeHash)) {
    verification.attempts += 1;
    return { ok: false as const, status: 422, message: "Kode verifikasi email tidak valid." };
  }
  const t = now();
  verification.consumedAt = t;
  user.email = email;
  user.emailVerified = true;
  user.updatedAt = t;
  return { ok: true as const, user: publicUser(user) };
}
