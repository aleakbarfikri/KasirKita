import { authError, requireOwner } from "@/lib/server/auth-guard";
import { fail, ok, readJson } from "@/lib/server/http";
import {
  hashPassword,
  now,
  readDb,
  verifyPassword,
  writeDb,
} from "@/lib/server/data-store";

type ChangePasswordPayload = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export async function POST(request: Request) {
  try {
    const session = await requireOwner();
    const body = await readJson<ChangePasswordPayload>(request);

    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

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

    const db = await readDb();
    const owner = db.users.find(
      (user) => user.id === session.user.id && user.role === "owner",
    );

    if (!owner) {
      return fail("Owner tidak ditemukan.", 404);
    }

    if (!verifyPassword(currentPassword, owner.passwordHash)) {
      return fail("Password lama salah.", 401);
    }

    owner.passwordHash = hashPassword(newPassword);
    owner.updatedAt = now();

    await writeDb(db);

    return ok({ changed: true });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
