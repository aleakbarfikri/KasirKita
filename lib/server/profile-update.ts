import { hashPassword, now, publicUser, revokeUserSessions, verifyPassword, type AppDb } from "@/lib/server/data-store";

export type ProfileUpdateInput = {
  name?: string;
  email?: string;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export function applyProfileUpdate(db: AppDb, userId: string, input: ProfileUpdateInput) {
  const user = db.users.find((row) => row.id === userId);
  if (!user) throw Object.assign(new Error("Akun tidak ditemukan."), { status: 404 });

  const name = input.name === undefined ? undefined : String(input.name).trim();
  const email = input.email === undefined ? undefined : String(input.email).trim().toLowerCase();
  const shopName = input.shopName === undefined ? undefined : String(input.shopName).trim();
  const shopAddress = input.shopAddress === undefined ? undefined : String(input.shopAddress).trim();
  const shopPhone = input.shopPhone === undefined ? undefined : String(input.shopPhone).trim();
  const currentPassword = String(input.currentPassword || "");
  const newPassword = String(input.newPassword || "");
  const confirmPassword = String(input.confirmPassword || "");
  const changesEmail = email !== undefined && email !== user.email.toLowerCase();
  const changesPassword = Boolean(newPassword || confirmPassword);

  if (name !== undefined && name.length < 2) throw Object.assign(new Error("Nama akun minimal 2 karakter."), { status: 422 });
  if (email !== undefined && !/^\S+@\S+\.\S+$/.test(email)) throw Object.assign(new Error("Email tidak valid."), { status: 422 });
  if (shopName !== undefined && shopName.length < 2) throw Object.assign(new Error("Nama UMKM minimal 2 karakter."), { status: 422 });
  if (changesEmail && db.users.some((row) => row.id !== user.id && row.email.toLowerCase() === email)) {
    throw Object.assign(new Error("Email sudah digunakan akun lain."), { status: 409 });
  }
  if ((changesEmail || changesPassword) && (!currentPassword || !verifyPassword(currentPassword, user.passwordHash))) {
    throw Object.assign(new Error("Password saat ini salah."), { status: 401 });
  }
  if (changesPassword) {
    if (newPassword.length < 12) throw Object.assign(new Error("Password baru minimal 12 karakter."), { status: 422 });
    if (newPassword !== confirmPassword) throw Object.assign(new Error("Konfirmasi password baru tidak sama."), { status: 422 });
    if (newPassword === currentPassword) throw Object.assign(new Error("Password baru tidak boleh sama dengan password lama."), { status: 422 });
    user.passwordHash = hashPassword(newPassword);
    revokeUserSessions(db, user.id);
  }

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (shopName !== undefined) user.shopName = shopName;

  let shop = null;
  if (user.role === "admin") {
    const profile = db.adminProfiles.find((row) => row.userId === user.id);
    shop = profile ? db.shops.find((row) => row.id === profile.shopId) ?? null : null;
    if (shop) {
      if (shopName !== undefined) shop.name = shopName;
      if (shopAddress !== undefined) shop.address = shopAddress || null;
      if (shopPhone !== undefined) shop.phone = shopPhone || null;
      shop.updatedAt = now();
    }
  }

  user.updatedAt = now();
  return { user: publicUser(user), shop, changed: true };
}
