import { assertOwnerOwnsAdmin, authError, requireOwner } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import { adminUpdateSchema } from "@/lib/server/validators";
import { addAuditLog, now, readDb, rowWithAdminProfile, verifyPassword, writeDb } from "@/lib/server/data-store";
import { applyManualSubscription, ensureSubscriptionDefaults } from "@/lib/server/subscription";

type Params = { params: Promise<{ id: string }> };

function getZodMessage(error: unknown) {
  const issues = typeof error === "object" && error !== null && "issues" in error ? (error as { issues?: Array<{ message?: string }> }).issues : undefined;
  return issues?.map((issue) => issue.message).filter(Boolean).join(". ") || "Data edit admin belum lengkap atau formatnya salah.";
}

export async function PATCH(request: Request, props: Params) {
  const params = await props.params;
  try {
    const session = await requireOwner();
    await assertOwnerOwnsAdmin(session.user.id, params.id);
    const parsed = adminUpdateSchema.safeParse(await readJson(request));
    if (!parsed.success) return fail(getZodMessage(parsed.error), 422, parsed.error.flatten());

    const body = parsed.data;
    const db = await readDb();
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
    if (body.shopPhone !== undefined) shop.phone = body.shopPhone || null;
    if (body.qrisStaticImageUrl !== undefined) shop.qrisStaticImageUrl = body.qrisStaticImageUrl || null;
    if (typeof body.isActive === "boolean") profile.isActive = body.isActive;
    if (body.activeUntil !== undefined) profile.activeUntil = body.activeUntil || null;
    if (body.planType !== undefined || body.planStatus !== undefined) {
      applyManualSubscription(profile, body.planType || ensureSubscriptionDefaults(profile).planType || "pro", body.activeUntil !== undefined ? body.activeUntil : profile.activeUntil);
      if (body.planStatus) profile.planStatus = body.planStatus;
    } else {
      ensureSubscriptionDefaults(profile);
    }

    const t = now();
    user.updatedAt = t;
    shop.updatedAt = t;
    profile.updatedAt = t;
    await writeDb(db);

    const updated = rowWithAdminProfile(db, profile);
    return ok(updated);
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status >= 400 ? status : 400);
  }
}

export async function DELETE(request: Request, props: Params) {
  const params = await props.params;
  try {
    const session = await requireOwner();
    await assertOwnerOwnsAdmin(session.user.id, params.id);
    const db = await readDb();
    const body = await readJson<{ ownerPassword?: string }>(request);
    const owner = db.users.find((row) => row.id === session.user.id && row.role === "owner");
    if (!owner || !verifyPassword(String(body.ownerPassword || ""), owner.passwordHash)) {
      return fail("Password owner salah. Admin tidak dihapus.", 401);
    }
    if (owner.id === params.id) return fail("Owner tidak bisa menghapus akun sendiri dari menu admin.", 400);

    const adminUser = db.users.find((row) => row.id === params.id);
    const profile = db.adminProfiles.find((row) => row.userId === params.id);
    if (!profile) return fail("Admin profile not found", 404);
    const shop = db.shops.find((row) => row.id === profile.shopId);
    const cashierIds = db.cashierProfiles.filter((row) => row.adminId === params.id || row.shopId === profile.shopId).map((row) => row.userId);
    const transactionIds = db.transactions.filter((row) => row.shopId === profile.shopId).map((row) => row.id);
    const debtIds = db.debts.filter((row) => row.shopId === profile.shopId || row.adminId === params.id).map((row) => row.id);
    const productCount = db.products.filter((row) => row.shopId === profile.shopId).length;

    db.sessions = db.sessions.filter((row) => row.userId !== params.id && !cashierIds.includes(row.userId));
    db.users = db.users.filter((row) => row.id !== params.id && !cashierIds.includes(row.id));
    db.adminProfiles = db.adminProfiles.filter((row) => row.userId !== params.id);
    db.cashierProfiles = db.cashierProfiles.filter((row) => row.adminId !== params.id && row.shopId !== profile.shopId);
    db.shops = db.shops.filter((row) => row.id !== profile.shopId);
    db.products = db.products.filter((row) => row.shopId !== profile.shopId);
    db.transactions = db.transactions.filter((row) => row.shopId !== profile.shopId);
    db.transactionItems = db.transactionItems.filter((row) => !transactionIds.includes(row.transactionId));
    db.debts = db.debts.filter((row) => row.shopId !== profile.shopId && row.adminId !== params.id);
    db.debtPayments = db.debtPayments.filter((row) => !debtIds.includes(row.debtId));
    db.withdrawals = db.withdrawals.filter((row) => row.adminId !== params.id);
    db.balances = db.balances.filter((row) => row.adminId !== params.id);
    db.cashShifts = db.cashShifts.filter((row) => row.shopId !== profile.shopId && !cashierIds.includes(row.cashierId));
    db.subscriptionInvoices = db.subscriptionInvoices.filter((row) => row.adminId !== params.id);
    db.auditLogs = db.auditLogs.filter((row) => row.shopId !== profile.shopId && row.actorId !== params.id && !cashierIds.includes(row.actorId));
    addAuditLog(db, {
      actorId: session.user.id,
      actorRole: "owner",
      action: "delete_admin",
      entityType: "admin",
      entityId: params.id,
      message: `Admin ${adminUser?.name || params.id}${shop?.name ? ` (${shop.name})` : ""} dihapus permanen oleh owner.`,
      metadata: {
        adminId: params.id,
        shopId: profile.shopId,
        cashierCount: cashierIds.length,
        productCount,
        transactionCount: transactionIds.length,
      },
    });
    await writeDb(db);
    return ok({ deleted: true, adminId: params.id });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
