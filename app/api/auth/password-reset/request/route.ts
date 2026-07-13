import crypto from "node:crypto";
import { sendPasswordResetCodeEmail } from "@/lib/server/email";
import { createId } from "@/lib/server/ids";
import { hashPassword, now, readDb, withDbTransaction, type EmailVerification } from "@/lib/server/data-store";
import { fail, ok, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { passwordResetRequestSchema } from "@/lib/server/validators";

export async function POST(request: Request) {
  try {
    const parsed = passwordResetRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail("Email tidak valid.", 422);
    const { email } = parsed.data;
    const ipLimit = await enforceRateLimit(request, "password-reset:ip", { limit: 10, windowMs: 15 * 60 * 1000 });
    const emailLimit = await enforceRateLimit(request, "password-reset:email", { limit: 4, windowMs: 15 * 60 * 1000 }, email);
    if (!ipLimit.allowed || !emailLimit.allowed) return fail("Terlalu banyak permintaan. Coba lagi beberapa menit lagi.", 429);

    const db = await readDb();
    const user = db.users.find((row) => row.email.toLowerCase() === email);
    if (!user) return ok({ sent: true });
    const recent = db.emailVerifications.find((row) => row.email === email && row.purpose === "password_reset" && !row.consumedAt && new Date(row.createdAt).getTime() > Date.now() - 60_000);
    if (recent) return ok({ sent: true, expiresAt: recent.expiresAt });

    const code = String(crypto.randomInt(100000, 1000000));
    await sendPasswordResetCodeEmail({ to: email, code });
    const record: EmailVerification = { id: createId("verify"), email, codeHash: hashPassword(code), purpose: "password_reset", attempts: 0, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), consumedAt: null, createdAt: now() };
    await withDbTransaction((currentDb) => {
      currentDb.emailVerifications = currentDb.emailVerifications.filter((row) => !(row.email === email && row.purpose === "password_reset" && !row.consumedAt));
      currentDb.emailVerifications.push(record);
    });
    return ok({ sent: true, expiresAt: record.expiresAt });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Gagal mengirim kode pemulihan.", 400);
  }
}
