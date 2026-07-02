import { authError, requireOwner } from "@/lib/server/auth-guard";
import { addAuditLog, createBackup, listBackups, readDb, writeDb } from "@/lib/server/data-store";
import { ok } from "@/lib/server/http";

export async function GET() {
  try {
    await requireOwner();
    return ok(await listBackups());
  } catch (error) {
    const { message, status } = authError(error);
    return Response.json({ ok: false, error: { message } }, { status });
  }
}

export async function POST() {
  try {
    const session = await requireOwner();
    const backup = await createBackup("owner-manual");
    const db = await readDb();
    addAuditLog(db, {
      actorId: session.user.id,
      actorRole: "owner",
      action: "create_backup",
      entityType: "backup",
      entityId: backup.id,
      message: "Owner membuat backup JSON manual.",
      metadata: { sizeBytes: backup.sizeBytes },
    });
    await writeDb(db);
    return ok(backup, { status: 201 });
  } catch (error) {
    const { message, status } = authError(error);
    return Response.json({ ok: false, error: { message } }, { status });
  }
}
