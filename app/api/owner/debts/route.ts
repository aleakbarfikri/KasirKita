import { authError, requireOwner } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { publicUser, readDb, sortDesc } from "@/lib/server/data-store";

export async function GET() {
  try {
    const session = await requireOwner();
    const db = await readDb();
    const ownerShops = db.shops.filter((shop) => shop.ownerId === session.user.id);
    const rows = db.debts
      .filter((debt) => ownerShops.some((shop) => shop.id === debt.shopId))
      .map((debt) => {
        const shop = ownerShops.find((row) => row.id === debt.shopId)!;
        const admin = db.users.find((user) => user.id === debt.adminId)!;
        return { debt, shop, admin: publicUser(admin) };
      });
    return ok(sortDesc(rows.map((row) => ({ ...row, createdAt: row.debt.createdAt })) as any[]).map(({ createdAt, ...row }) => row));
  } catch (error) {
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
