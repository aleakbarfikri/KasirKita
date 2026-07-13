import assert from "node:assert/strict";
import test from "node:test";
import { deleteAccountData } from "../lib/server/account-deletion";
import { defaultDb, hashPassword, verifyPassword } from "../lib/server/data-store";
import { applyPasswordReset } from "../lib/server/password-reset";
import { applyProfileUpdate } from "../lib/server/profile-update";
import { projectNormalizedRows } from "../lib/server/normalized-projection";
import { adminUpdateSchema, passwordResetConfirmSchema, registerAdminSchema } from "../lib/server/validators";

function fixture() {
  const db = defaultDb();
  const t = new Date().toISOString();
  db.users.push(
    { id: "owner", name: "Owner", email: "owner@example.com", username: "owner", role: "owner", passwordHash: hashPassword("OwnerPassword123"), createdAt: t, updatedAt: t },
    { id: "admin", name: "Admin", email: "admin@example.com", username: "admin", role: "admin", passwordHash: hashPassword("AdminPassword123"), createdAt: t, updatedAt: t },
    { id: "cashier", name: "Kasir", email: "cashier@example.com", username: "cashier", role: "cashier", passwordHash: hashPassword("CashierPassword123"), createdAt: t, updatedAt: t },
  );
  db.shops.push({ id: "shop", ownerId: "owner", name: "Toko", createdAt: t, updatedAt: t });
  db.adminProfiles.push({ userId: "admin", ownerId: "owner", shopId: "shop", isActive: true, createdAt: t, updatedAt: t });
  db.cashierProfiles.push({ userId: "cashier", adminId: "admin", ownerId: "owner", shopId: "shop", isActive: true, approvalStatus: "approved", createdAt: t, updatedAt: t });
  db.products.push({ id: "product", shopId: "shop", sku: "P1", name: "Produk", price: 1000, costPrice: 500, isActive: true, createdAt: t, updatedAt: t });
  db.transactions.push({ id: "transaction", shopId: "shop", cashierId: "cashier", paymentMethod: "cash", total: 1000, status: "success", createdAt: t, updatedAt: t });
  db.transactionItems.push({ id: "item", transactionId: "transaction", sku: "P1", name: "Produk", price: 1000, quantity: 1, subtotal: 1000 });
  db.sessions.push({ id: "session", token: "hash", userId: "admin", expiresAt: new Date(Date.now() + 60_000).toISOString(), createdAt: t, updatedAt: t });
  return db;
}

test("registration requires explicit legal consent", () => {
  const input = { name: "Admin", username: "admin_baru", email: "admin@baru.com", password: "PasswordBaru123", shopName: "Toko Baru", verificationCode: "123456" };
  assert.equal(registerAdminSchema.safeParse(input).success, false);
  assert.equal(registerAdminSchema.safeParse({ ...input, acceptTerms: true }).success, true);
});

test("Owner admin editor accepts a valid email and rejects an invalid one", () => {
  assert.equal(adminUpdateSchema.safeParse({ email: "baru@umkm.com" }).success, true);
  assert.equal(adminUpdateSchema.safeParse({ email: "bukan-email" }).success, false);
});

test("admin can update email, address, and phone with current password", () => {
  const db = fixture();
  const result = applyProfileUpdate(db, "admin", {
    email: "kontak@tokobaru.com",
    shopName: "Toko Baru",
    shopAddress: "Jl. Merdeka No. 1",
    shopPhone: "081234567890",
    currentPassword: "AdminPassword123",
  });
  assert.equal(result.user.email, "kontak@tokobaru.com");
  assert.equal(result.shop?.name, "Toko Baru");
  assert.equal(result.shop?.address, "Jl. Merdeka No. 1");
  assert.equal(result.shop?.phone, "081234567890");
});

test("self-service email update requires password and a unique email", () => {
  const db = fixture();
  assert.throws(() => applyProfileUpdate(db, "admin", { email: "owner@example.com", currentPassword: "AdminPassword123" }), /Email sudah digunakan/);
  assert.throws(() => applyProfileUpdate(db, "admin", { email: "baru@example.com" }), /Password saat ini salah/);
  assert.equal(db.users.find((row) => row.id === "admin")?.email, "admin@example.com");
});

test("Owner can add or edit email from profile settings", () => {
  const db = fixture();
  const result = applyProfileUpdate(db, "owner", { email: "ownerbaru@example.com", currentPassword: "OwnerPassword123" });
  assert.equal(result.user.email, "ownerbaru@example.com");
});

test("password reset validates input, consumes code, and revokes sessions", () => {
  assert.equal(passwordResetConfirmSchema.safeParse({ email: "admin@example.com", verificationCode: "123456", password: "PasswordBaru456" }).success, true);
  const db = fixture();
  db.emailVerifications.push({ id: "verify", email: "admin@example.com", codeHash: hashPassword("123456"), purpose: "password_reset", attempts: 0, expiresAt: new Date(Date.now() + 60_000).toISOString(), createdAt: new Date().toISOString() });
  const result = applyPasswordReset(db, { email: "admin@example.com", verificationCode: "123456", password: "PasswordBaru456" });
  assert.deepEqual(result, { ok: true });
  assert.equal(db.sessions.some((row) => row.userId === "admin"), false);
  assert.equal(Boolean(db.emailVerifications[0].consumedAt), true);
  assert.equal(verifyPassword("PasswordBaru456", db.users.find((row) => row.id === "admin")!.passwordHash), true);
});

test("wrong recovery code persists its attempt counter", () => {
  const db = fixture();
  db.emailVerifications.push({ id: "verify", email: "admin@example.com", codeHash: hashPassword("123456"), purpose: "password_reset", attempts: 0, expiresAt: new Date(Date.now() + 60_000).toISOString(), createdAt: new Date().toISOString() });
  const result = applyPasswordReset(db, { email: "admin@example.com", verificationCode: "000000", password: "PasswordBaru456" });
  assert.equal(result.ok, false);
  assert.equal(db.emailVerifications[0].attempts, 1);
});

test("admin deletion removes the full shop tenant but preserves platform owner", () => {
  const db = fixture();
  const result = deleteAccountData(db, "admin");
  assert.deepEqual(result, { role: "admin", deletedUsers: 2, deletedShop: true });
  assert.deepEqual(db.users.map((row) => row.id), ["owner"]);
  assert.equal(db.shops.length, 0);
  assert.equal(db.products.length, 0);
  assert.equal(db.transactions.length, 0);
  assert.equal(db.transactionItems.length, 0);
  assert.equal(db.sessions.length, 0);
});

test("normalized projection preserves tenant lookup fields", () => {
  const rows = projectNormalizedRows(fixture());
  const product = rows.find((row) => row.entityType === "products" && row.entityId === "product");
  const cashier = rows.find((row) => row.entityType === "users" && row.entityId === "cashier");
  assert.equal(product?.shopId, "shop");
  assert.equal(cashier?.shopId, "shop");
  assert.equal(cashier?.adminId, "admin");
});
