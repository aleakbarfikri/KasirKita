import { createOffsiteBackup } from "@/lib/server/offsite-backup";
import { addAuditLog, createBackup, withDbTransaction } from "@/lib/server/data-store";
import { protectPaymentConfig } from "@/lib/server/payment-secrets";
import { reportOperationalIncident } from "@/lib/server/monitoring";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    await withDbTransaction((db) => {
      db.paymentConfigs.forEach(protectPaymentConfig);
    });
    const dashboardBackup = await createBackup("scheduled-daily");
    const offsiteBackup = await createOffsiteBackup("scheduled-daily");
    await withDbTransaction((db) => {
      const owner = db.users.find((user) => user.role === "owner");
      if (!owner) return;
      addAuditLog(db, {
        actorId: owner.id,
        actorRole: "owner",
        action: "create_backup",
        entityType: "backup",
        entityId: dashboardBackup.id,
        message: "Sistem membuat backup harian otomatis dan memverifikasi salinan terenkripsi di Blob storage.",
        metadata: { reason: "scheduled-daily", offsiteBackupId: offsiteBackup.id, checksum: offsiteBackup.checksum },
      });
    });
    return Response.json({ ok: true, data: { dashboardBackup, offsiteBackup } });
  } catch (error) {
    await reportOperationalIncident(error, { operation: "scheduled_offsite_backup", severity: "critical" });
    return Response.json({ ok: false, error: { message: "Backup gagal dibuat" } }, { status: 503 });
  }
}
