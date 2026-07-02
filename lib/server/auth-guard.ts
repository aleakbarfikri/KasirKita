import { cookies } from "next/headers";
import { getShopByIdFromDb, getUserByIdFromDb, publicUser, readDb, verifySignedSessionToken, type AppSession } from "@/lib/server/data-store";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  displayUsername?: string | null;
  role?: "owner" | "admin" | "cashier";
  shopName?: string | null;
};

export async function getCurrentSession() {
  const token = cookies().get("kasirkita_session")?.value;
  if (!token) return null;

  const db = await readDb();
  const signed = verifySignedSessionToken(token);
  if (signed) {
    const user = getUserByIdFromDb(db, signed.userId);
    if (!user) return null;
    const session = { token, userId: signed.userId, expiresAt: signed.expiresAt } as AppSession;
    return { session, user: publicUser(user) as SessionUser };
  }

  const session = db.sessions.find((row) => row.token === token) as AppSession | undefined;
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;

  const user = getUserByIdFromDb(db, session.userId);
  if (!user) return null;

  return { session, user: publicUser(user) as SessionUser };
}

export async function requireAuth() {
  const session = await getCurrentSession();
  if (!session?.user) {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  }
  return session as typeof session & { user: SessionUser };
}

export async function requireOwner() {
  const session = await requireAuth();
  if (session.user.role !== "owner") {
    throw Object.assign(new Error("Owner access required"), { status: 403 });
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "admin") {
    throw Object.assign(new Error("Admin access required"), { status: 403 });
  }
  return session;
}

export async function requirePosUser() {
  const session = await requireAuth();
  if (session.user.role !== "admin" && session.user.role !== "cashier") {
    throw Object.assign(new Error("Admin or cashier access required"), { status: 403 });
  }
  return session;
}

export function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unauthorized";
  const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status: unknown }).status) : 401;
  return { message, status: Number.isFinite(status) ? status : 401 };
}

export async function getAdminScope(adminId: string) {
  const db = await readDb();
  const profile = db.adminProfiles.find((row) => row.userId === adminId && row.isActive);
  if (profile) {
    const shop = getShopByIdFromDb(db, profile.shopId);
    if (!shop) {
      throw Object.assign(new Error("Shop not found for this admin"), { status: 403 });
    }

    return {
      adminId: profile.userId,
      ownerId: profile.ownerId,
      shopId: profile.shopId,
      shopName: shop.name,
      qrisStaticImageUrl: shop.qrisStaticImageUrl,
    };
  }

  const cashierProfile = db.cashierProfiles.find((row) => row.userId === adminId && row.isActive && row.approvalStatus === "approved");
  if (!cashierProfile) {
    throw Object.assign(new Error("Admin profile is not active or has no shop"), { status: 403 });
  }
  const shop = getShopByIdFromDb(db, cashierProfile.shopId);
  if (!shop) {
    throw Object.assign(new Error("Shop not found for this admin"), { status: 403 });
  }

  return {
    adminId: cashierProfile.adminId,
    ownerId: cashierProfile.ownerId,
    shopId: cashierProfile.shopId,
    shopName: shop.name,
    qrisStaticImageUrl: shop.qrisStaticImageUrl,
  };
}

export async function assertOwnerOwnsAdmin(ownerId: string, adminId: string) {
  const db = await readDb();
  const profile = db.adminProfiles.find((row) => row.ownerId === ownerId && row.userId === adminId);
  if (!profile) {
    throw Object.assign(new Error("Admin not found for this owner"), { status: 404 });
  }
}

export async function getOwnerShop(ownerId: string) {
  const db = await readDb();
  return db.shops.find((shop) => shop.ownerId === ownerId) || null;
}

export async function getUserById(id: string) {
  const db = await readDb();
  const user = getUserByIdFromDb(db, id);
  return user ? publicUser(user) : null;
}
