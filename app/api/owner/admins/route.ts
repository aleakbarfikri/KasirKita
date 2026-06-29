import { authError, requireOwner } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { adminCreateSchema } from "@/lib/server/validators";
import { hashPassword, now, publicUser, readDb, rowWithAdminProfile, writeDb, type AdminProfile, type AppUser, type Balance, type Shop } from "@/lib/server/data-store";

function getZodMessage(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error as { issues?: Array<{ message?: string }> }).issues : undefined;
  return issues?.map((issue) => issue.message).filter(Boolean).join(". ") || "Data admin belum lengkap atau formatnya salah.";
}

export async function GET() {
  try {
    const session = await requireOwner();
    const db = readDb();
    const rows = db.adminProfiles
      .filter((profile) => profile.ownerId === session.user.id)
      .map((profile) => rowWithAdminProfile(db, profile))
      .filter(Boolean);
    return ok((rows as NonNullable<ReturnType<typeof rowWithAdminProfile>>[]).sort((a, b) => b.profile.createdAt.localeCompare(a.profile.createdAt)));
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireOwner();
    const parsed = adminCreateSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(getZodMessage(parsed.error), 422, parsed.error.flatten());
    const body = parsed.data;
    const db = readDb();

    if (db.users.some((user) => user.email.toLowerCase() === body.email.toLowerCase())) return fail("Email sudah digunakan.", 409);
    if (db.users.some((user) => user.username.toLowerCase() === body.username.toLowerCase())) return fail("Username sudah digunakan.", 409);

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
      ownerId: session.user.id,
      name: body.shopName,
      address: body.shopAddress || null,
      qrisStaticImageUrl: null,
      createdAt: t,
      updatedAt: t,
    };
    const profile: AdminProfile = {
      userId: user.id,
      ownerId: session.user.id,
      shopId: shop.id,
      isActive: true,
      createdAt: t,
      updatedAt: t,
    };
    const balance: Balance = { adminId: user.id, totalEarnedQrisApi: 0, totalWithdrawn: 0, updatedAt: t };

    db.users.push(user);
    db.shops.push(shop);
    db.adminProfiles.push(profile);
    db.balances.push(balance);
    writeDb(db);

    return ok({ admin: publicUser(user), profile, shop, balance }, { status: 201 });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status >= 400 ? status : 400);
  }
}
