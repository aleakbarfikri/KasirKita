import { sortDesc, type AppDb, type AuditLog } from "@/lib/server/data-store";

export type AuditLogView = AuditLog & {
  actorName: string;
  actorUsername: string | null;
  adminId: string | null;
  adminName: string | null;
  shopName: string | null;
};

function enrichAuditLog(db: AppDb, log: AuditLog): AuditLogView {
  const actor = db.users.find((user) => user.id === log.actorId);
  const shop = log.shopId ? db.shops.find((row) => row.id === log.shopId) : null;
  const cashierProfile = log.actorRole === "cashier" ? db.cashierProfiles.find((row) => row.userId === log.actorId) : null;
  const shopAdminProfile = shop ? db.adminProfiles.find((row) => row.shopId === shop.id) : null;
  const adminId = log.actorRole === "admin" ? log.actorId : cashierProfile?.adminId ?? shopAdminProfile?.userId ?? null;
  const admin = adminId ? db.users.find((user) => user.id === adminId && user.role === "admin") : null;

  return {
    ...log,
    actorName: actor?.name || actor?.username || "Akun tidak tersedia",
    actorUsername: actor?.username ?? null,
    adminId,
    adminName: admin?.name || admin?.username || null,
    shopName: shop?.name ?? null,
  };
}

export function ownerAuditLogRows(db: AppDb, ownerId: string, limit = 200) {
  const ownerShopIds = new Set(db.shops.filter((shop) => shop.ownerId === ownerId).map((shop) => shop.id));
  const adminIds = new Set(db.adminProfiles.filter((profile) => profile.ownerId === ownerId).map((profile) => profile.userId));
  const cashierIds = db.cashierProfiles.filter((profile) => adminIds.has(profile.adminId)).map((profile) => profile.userId);
  const ownerActorIds = new Set([ownerId, ...Array.from(adminIds), ...cashierIds]);
  const visible = db.auditLogs.filter((log) => (Boolean(log.shopId) && ownerShopIds.has(log.shopId!)) || ownerActorIds.has(log.actorId));
  return sortDesc(visible).slice(0, limit).map((log) => enrichAuditLog(db, log));
}

export function shopAuditLogRows(db: AppDb, shopId: string, actorId: string, limit = 200) {
  const visible = db.auditLogs.filter((log) => log.shopId === shopId || log.actorId === actorId);
  return sortDesc(visible).slice(0, limit).map((log) => enrichAuditLog(db, log));
}
