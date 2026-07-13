import crypto from "node:crypto";
import { sendVerificationCodeEmail } from "@/lib/server/email";
import { fail, ok, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { createId } from "@/lib/server/ids";
import { registerVerificationRequestSchema } from "@/lib/server/validators";
import { hashPassword, now, readDb, writeDb, type EmailVerification } from "@/lib/server/data-store";

function createVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function expiresInMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function getZodMessage(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error as { issues?: Array<{ message?: string }> }).issues : undefined;
  return issues?.map((issue) => issue.message).filter(Boolean).join(". ") || "Email belum valid.";
}

export async function POST(request: Request) {
  try {
    const ipLimit = await enforceRateLimit(request, "register:request-code:ip", { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.allowed) return fail("Terlalu banyak permintaan kode. Coba lagi beberapa menit lagi.", 429);
    const parsed = registerVerificationRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(getZodMessage(parsed.error), 422, parsed.error.flatten());
    const body = parsed.data;
    const emailLimit = await enforceRateLimit(request, "register:request-code:email", { limit: 5, windowMs: 15 * 60 * 1000 }, body.email);
    if (!emailLimit.allowed) return fail("Terlalu banyak permintaan kode. Coba lagi beberapa menit lagi.", 429);
    const db = await readDb();

    if (db.users.some((user) => user.email.toLowerCase() === body.email.toLowerCase())) return fail("Email sudah digunakan.", 409);

    const recent = db.emailVerifications.find((row) =>
      row.email === body.email &&
      row.purpose === "register" &&
      !row.consumedAt &&
      new Date(row.createdAt).getTime() > Date.now() - 60 * 1000
    );
    if (recent) return fail("Kode sudah dikirim. Tunggu 1 menit sebelum meminta kode baru.", 429);

    const code = createVerificationCode();
    await sendVerificationCodeEmail({ to: body.email, code, shopName: body.shopName || undefined });

    const record: EmailVerification = {
      id: createId("verify"),
      email: body.email,
      codeHash: hashPassword(code),
      purpose: "register",
      attempts: 0,
      expiresAt: expiresInMinutes(10),
      consumedAt: null,
      createdAt: now(),
    };
    db.emailVerifications.push(record);
    db.emailVerifications = db.emailVerifications
      .filter((row) => !row.consumedAt && new Date(row.expiresAt).getTime() > Date.now() - 24 * 60 * 60 * 1000)
      .slice(-200);
    await writeDb(db);

    return ok({ sent: true, expiresAt: record.expiresAt });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 400;
    return fail(error instanceof Error ? error.message : "Gagal mengirim kode verifikasi.", Number.isFinite(status) ? status : 400);
  }
}
