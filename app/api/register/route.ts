import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { registerAdminSchema } from "@/lib/server/validators";
import { hashPassword, now, publicUser, readDb, verifyPassword, writeDb, type AdminProfile, type AppUser, type Balance, type Shop } from "@/lib/server/data-store";
import { startTrialProfile } from "@/lib/server/subscription";
import { enforceRateLimit } from "@/lib/server/rate-limit";

function getZodMessage(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error as { issues?: Array<{ message?: string }> }).issues : undefined;
  return issues?.map((issue) => issue.message).filter(Boolean).join(". ") || "Data daftar belum lengkap atau formatnya salah.";
}

export async function POST(request: Request) {
  try {
    const ipLimit = await enforceRateLimit(request, "register:verify:ip", { limit: 20, windowMs: 15 * 60 * 1000 });
    if (!ipLimit.allowed) return fail("Terlalu banyak percobaan verifikasi. Coba lagi beberapa menit lagi.", 429);
    const parsed = registerAdminSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(getZodMessage(parsed.error), 422, parsed.error.flatten());
    const body = parsed.data;
    const emailLimit = await enforceRateLimit(request, "register:verify:email", { limit: 8, windowMs: 15 * 60 * 1000 }, body.email);
    if (!emailLimit.allowed) return fail("Terlalu banyak percobaan verifikasi. Coba lagi beberapa menit lagi.", 429);
    const db = await readDb();

    if (db.users.some((user) => user.email.toLowerCase() === body.email.toLowerCase())) return fail("Email sudah digunakan.", 409);
    if (db.users.some((user) => user.username.toLowerCase() === body.username.toLowerCase())) return fail("Username sudah digunakan.", 409);

    const verification = [...db.emailVerifications]
      .reverse()
      .find((row) => row.email === body.email && row.purpose === "register" && !row.consumedAt);
    if (!verification) return fail("Kode verifikasi belum dikirim atau sudah dipakai.", 422);
    if (new Date(verification.expiresAt).getTime() <= Date.now()) return fail("Kode verifikasi sudah expired. Kirim kode baru.", 422);
    if (verification.attempts >= 5) return fail("Kode verifikasi terlalu sering salah. Kirim kode baru.", 429);
    if (!verifyPassword(body.verificationCode, verification.codeHash)) {
      verification.attempts += 1;
      await writeDb(db);
      return fail("Kode verifikasi salah.", 422);
    }

    const owner = body.ownerId
      ? db.users.find((user) => user.id === body.ownerId && user.role === "owner")
      : db.users.find((user) => user.role === "owner");
    if (!owner) return fail("Owner KasirKita belum tersedia. Hubungi admin.", 422);

    const t = now();
    const user: AppUser = {
      id: createId("user"),
      name: body.name,
      email: body.email,
      emailVerified: true,
      image: null,
      username: body.username,
      displayUsername: body.username,
      role: "admin",
      shopName: body.shopName,
      passwordHash: hashPassword(body.password),
      createdAt: t,
      updatedAt: t,
    };
    const shop: Shop = {
      id: createId("shop"),
      ownerId: owner.id,
      name: body.shopName,
      address: body.shopAddress || null,
      phone: body.shopPhone || null,
      qrisStaticImageUrl: null,
      createdAt: t,
      updatedAt: t,
    };
    const profile = startTrialProfile({
      userId: user.id,
      ownerId: owner.id,
      shopId: shop.id,
      isActive: true,
      activeUntil: null,
      createdAt: t,
      updatedAt: t,
    } as AdminProfile, 14);
    const balance: Balance = { adminId: user.id, totalEarnedQrisApi: 0, totalWithdrawn: 0, updatedAt: t };

    db.users.push(user);
    db.shops.push(shop);
    db.adminProfiles.push(profile);
    db.balances.push(balance);
    verification.consumedAt = now();
    await writeDb(db);

    return ok({ admin: publicUser(user), profile, shop, balance, trialDays: 14 }, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Gagal daftar trial.", 400);
  }
}
