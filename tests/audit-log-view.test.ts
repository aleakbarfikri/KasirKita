import assert from "node:assert/strict";
import test from "node:test";
import { ownerAuditLogRows } from "../lib/server/audit-log-view";
import { defaultDb, type AuditLog } from "../lib/server/data-store";

test("Owner activity log is tenant-safe and identifies the responsible admin for cashier activity", () => {
  const db = defaultDb();
  const createdAt = "2026-07-15T10:00:00.000Z";
  db.users.push(
    { id: "owner_a", name: "Owner A", email: "owner-a@example.com", username: "owner-a", role: "owner", passwordHash: "hash", createdAt, updatedAt: createdAt },
    { id: "owner_b", name: "Owner B", email: "owner-b@example.com", username: "owner-b", role: "owner", passwordHash: "hash", createdAt, updatedAt: createdAt },
    { id: "admin_a", name: "Admin Jakarta", email: "admin-a@example.com", username: "admin-a", role: "admin", passwordHash: "hash", createdAt, updatedAt: createdAt },
    { id: "admin_b", name: "Admin Bandung", email: "admin-b@example.com", username: "admin-b", role: "admin", passwordHash: "hash", createdAt, updatedAt: createdAt },
    { id: "cashier_a", name: "Kasir Pagi", email: "cashier-a@example.com", username: "cashier-a", role: "cashier", passwordHash: "hash", createdAt, updatedAt: createdAt },
  );
  db.shops.push(
    { id: "shop_a", ownerId: "owner_a", name: "Toko Jakarta", createdAt, updatedAt: createdAt },
    { id: "shop_b", ownerId: "owner_b", name: "Toko Bandung", createdAt, updatedAt: createdAt },
  );
  db.adminProfiles.push(
    { userId: "admin_a", ownerId: "owner_a", shopId: "shop_a", isActive: true, createdAt, updatedAt: createdAt },
    { userId: "admin_b", ownerId: "owner_b", shopId: "shop_b", isActive: true, createdAt, updatedAt: createdAt },
  );
  db.cashierProfiles.push({ userId: "cashier_a", adminId: "admin_a", ownerId: "owner_a", shopId: "shop_a", isActive: true, approvalStatus: "approved", createdAt, updatedAt: createdAt });

  const log = (id: string, actorId: string, actorRole: AuditLog["actorRole"], shopId: string | null): AuditLog => ({ id, actorId, actorRole, shopId, action: "create_transaction", entityType: "transaction", entityId: id, message: `Log ${id}`, createdAt });
  db.auditLogs.push(
    log("own-cashier", "cashier_a", "cashier", "shop_a"),
    log("own-global", "owner_a", "owner", null),
    log("other-shop", "admin_b", "admin", "shop_b"),
    log("other-global", "owner_b", "owner", null),
  );

  const rows = ownerAuditLogRows(db, "owner_a");
  assert.deepEqual(rows.map((row) => row.id).sort(), ["own-cashier", "own-global"]);
  const cashierLog = rows.find((row) => row.id === "own-cashier");
  assert.equal(cashierLog?.actorName, "Kasir Pagi");
  assert.equal(cashierLog?.adminId, "admin_a");
  assert.equal(cashierLog?.adminName, "Admin Jakarta");
  assert.equal(cashierLog?.shopName, "Toko Jakarta");
});
