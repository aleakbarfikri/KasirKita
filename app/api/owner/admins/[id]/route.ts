import { assertOwnerOwnsAdmin, authError, requireOwner } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { adminUpdateSchema } from "@/lib/server/validators";
import { now, readDb, rowWithAdminProfile, writeDb } from "@/lib/server/data-store";

type Params = { params: { id: string } };

function getZodMessage(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error as { issues?: Array<{ message?: string }> }).issues : undefined;
  return issues?.map((issue) => issue.message).filter(Boolean).join(". ") || "Data edit admin belum lengkap atau formatnya salah.";
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await requireOwner();
    await assertOwnerOwnsAdmin(session.user.id, params.id);
    const parsed = adminUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(getZodMessage(parsed.error), 422, parsed.error.flatten());

    const body = parsed.data;
    const db = readDb();
    const user = db.users.find((row) => row.id === params.id);
    const profile = db.adminProfiles.find((row) => row.userId === params.id);
    if (!user || !profile) return fail("Admin profile not found", 404);
    const shop = db.shops.find((row) => row.id === profile.shopId);
    if (!shop) return fail("Shop not found", 404);

    if (body.username && db.users.some((row) => row.id !== user.id && row.username.toLowerCase() === body.username!.toLowerCase())) {
      return fail("Username sudah digunakan.", 409);
    }

    if (body.name !== undefined) user.name = body.name;
    if (body.username !== undefined) {
      user.username = body.username;
      user.displayUsername = body.username;
    }
    if (body.shopName !== undefined) {
      user.shopName = body.shopName;
      shop.name = body.shopName;
    }
    if (body.shopAddress !== undefined) shop.address = body.shopAddress;
    if (body.qrisStaticImageUrl !== undefined) shop.qrisStaticImageUrl = body.qrisStaticImageUrl || null;
    if (typeof body.isActive === "boolean") profile.isActive = body.isActive;

    const t = now();
    user.updatedAt = t;
    shop.updatedAt = t;
    profile.updatedAt = t;
    writeDb(db);

    const updated = rowWithAdminProfile(db, profile);
    return ok(updated);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status >= 400 ? status : 400);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await requireOwner();
    await assertOwnerOwnsAdmin(session.user.id, params.id);
    const db = readDb();
    const profile = db.adminProfiles.find((row) => row.userId === params.id);
    if (!profile) return fail("Admin profile not found", 404);
    profile.isActive = false;
    profile.updatedAt = now();
    writeDb(db);
    return ok(profile);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
