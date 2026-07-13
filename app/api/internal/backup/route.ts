import { createOffsiteBackup } from "@/lib/server/offsite-backup";
import { withDbTransaction } from "@/lib/server/data-store";
import { protectPaymentConfig } from "@/lib/server/payment-secrets";

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
    const backup = await createOffsiteBackup("scheduled-daily");
    return Response.json({ ok: true, data: backup });
  } catch {
    return Response.json({ ok: false, error: { message: "Backup gagal dibuat" } }, { status: 503 });
  }
}
