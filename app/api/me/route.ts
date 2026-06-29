import { fail, ok } from "@/lib/server/http";
import { authError, requireAuth } from "@/lib/server/auth-guard";
import { readDb } from "@/lib/server/data-store";

export async function GET() {
  try {
    const session = await requireAuth();
    let shop = null;

    if (session.user.role === "admin") {
      const db = await readDb();
      const profile = db.adminProfiles.find((row) => row.userId === session.user.id && row.isActive);
      shop = profile ? db.shops.find((row) => row.id === profile.shopId) ?? null : null;
    }

    return ok({ user: session.user, session: session.session, shop });
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
