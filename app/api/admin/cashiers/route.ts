import { authError, getAdminScope, requireAdmin } from "@/lib/server/auth-guard";
import { rowWithCashierProfile } from "@/lib/server/cashier-helpers";
import { hashPassword, now, publicUser, readDb, writeDb, type AppUser, type CashierProfile } from "@/lib/server/data-store";
import { fail, ok, readJson } from "@/lib/server/http";
import { createId } from "@/lib/server/ids";
import { cashierCreateSchema } from "@/lib/server/validators";

function getZodMessage(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error as { issues?: Array<{ message?: string }> }).issues : undefined;
  return issues?.map((issue) => issue.message).filter(Boolean).join(". ") || "Data kasir belum lengkap atau formatnya salah.";
}

export async function GET() {
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const db = await readDb();
    const rows = db.cashierProfiles
      .filter((profile) => profile.adminId === session.user.id && profile.shopId === scope.shopId)
      .map((profile) => rowWithCashierProfile(db, profile))
      .filter(Boolean);
    return ok((rows as NonNullable<ReturnType<typeof rowWithCashierProfile>>[]).sort((a, b) => b.profile.createdAt.localeCompare(a.profile.createdAt)));
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const scope = await getAdminScope(session.user.id);
    const parsed = cashierCreateSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(getZodMessage(parsed.error), 422, parsed.error.flatten());
    const body = parsed.data;
    const db = await readDb();

    if (db.users.some((user) => user.email.toLowerCase() === body.email.toLowerCase())) return fail("Email sudah digunakan.", 409);
    if (db.users.some((user) => user.username.toLowerCase() === body.username.toLowerCase())) return fail("Username sudah digunakan.", 409);

    const approvedCashiers = db.cashierProfiles.filter((profile) => profile.adminId === session.user.id && profile.shopId === scope.shopId && profile.isActive && profile.approvalStatus === "approved");
    const approvalStatus: CashierProfile["approvalStatus"] = approvedCashiers.length === 0 ? "approved" : "pending";
    const t = now();
    const user: AppUser = {
      id: createId("user"),
      name: body.name,
      email: body.email,
      emailVerified: true,
      image: null,
      username: body.username,
      displayUsername: body.username,
      role: "cashier",
      shopName: scope.shopName,
      passwordHash: hashPassword(body.password),
      createdAt: t,
      updatedAt: t,
    };
    const profile: CashierProfile = {
      userId: user.id,
      adminId: session.user.id,
      ownerId: scope.ownerId,
      shopId: scope.shopId,
      isActive: approvalStatus === "approved",
      approvalStatus,
      createdAt: t,
      updatedAt: t,
    };

    db.users.push(user);
    db.cashierProfiles.push(profile);
    await writeDb(db);

    return ok({ cashier: publicUser(user), profile, shop: { id: scope.shopId, ownerId: scope.ownerId, name: scope.shopName, qrisStaticImageUrl: scope.qrisStaticImageUrl } }, { status: 201 });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status >= 400 ? status : 400);
  }
}
