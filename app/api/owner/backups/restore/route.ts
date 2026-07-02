import { authError, requireOwner } from "@/lib/server/auth-guard";
import { fail, ok } from "@/lib/server/http";
import { restoreBackupData } from "@/lib/server/data-store";

function extractBackupData(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const record = payload as { data?: unknown; info?: unknown };
  return record.data ?? payload;
}

export async function POST(request: Request) {
  try {
    const session = await requireOwner();

    const contentType = request.headers.get("content-type") || "";
    let payload: unknown;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("backup");
      if (!(file instanceof File)) return fail("File backup JSON wajib di-upload.", 422);
      payload = JSON.parse(await file.text());
    } else {
      payload = await request.json();
    }

    const result = await restoreBackupData(extractBackupData(payload), { actorId: session.user.id, actorRole: "owner" });
    return ok({
      backupBeforeRestore: result.backupBeforeRestore,
      restoredAt: new Date().toISOString(),
      counts: {
        users: result.restored.users.length,
        shops: result.restored.shops.length,
        products: result.restored.products.length,
        transactions: result.restored.transactions.length,
        debts: result.restored.debts.length,
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) return fail("File backup bukan JSON yang valid.", 422);
    const { message, status } = authError(error);
    return fail(message, status);
  }
}
