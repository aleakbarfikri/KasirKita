import { authError, requireAuth } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import {
  hashPassword,
  now,
  publicUser,
  readDb,
  verifyPassword,
  writeDb,
} from "@/lib/server/data-store";

type ProfilePayload = {
  name?: string;
  shopName?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export async function PATCH(request: Request) {
  try {
    const session = await requireAuth();
    const body = await readJson<ProfilePayload>(request);
    const db = await readDb();
    const user = db.users.find((row) => row.id === session.user.id);

    if (!user) return fail("Akun tidak ditemukan.", 404);

    const name = String(body.name ?? "").trim();
    const shopName = String(body.shopName ?? "").trim();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");
    const wantsPasswordChange = Boolean(currentPassword || newPassword || confirmPassword);

    if (name && name.length < 2) {
      return fail("Nama akun minimal 2 karakter.", 422);
    }

    if (shopName && shopName.length < 2) {
      return fail("Nama UMKM minimal 2 karakter.", 422);
    }

    if (wantsPasswordChange) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        return fail("Semua field password wajib diisi.", 422);
      }

      if (newPassword.length < 8) {
        return fail("Password baru minimal 8 karakter.", 422);
      }

      if (newPassword !== confirmPassword) {
        return fail("Konfirmasi password baru tidak sama.", 422);
      }

      if (newPassword === currentPassword) {
        return fail("Password baru tidak boleh sama dengan password lama.", 422);
      }

      if (!verifyPassword(currentPassword, user.passwordHash)) {
        return fail("Password lama salah.", 401);
      }

      user.passwordHash = hashPassword(newPassword);
    }

    if (name) user.name = name;

    let shop = null;
    if (shopName) {
      user.shopName = shopName;

      if (user.role === "admin") {
        const profile = db.adminProfiles.find((row) => row.userId === user.id && row.isActive);
        shop = profile ? db.shops.find((row) => row.id === profile.shopId) ?? null : null;
        if (shop) {
          shop.name = shopName;
          shop.updatedAt = now();
        }
      }
    }

    user.updatedAt = now();
    await writeDb(db);

    return ok({ user: publicUser(user), shop, changed: true });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status >= 400 ? status : 400);
  }
}
