import { createOffsiteBackup } from "@/lib/server/offsite-backup";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  try {
    const backup = await createOffsiteBackup("scheduled-daily");
    return Response.json({ ok: true, data: backup });
  } catch {
    return Response.json({ ok: false, error: { message: "Backup gagal dibuat" } }, { status: 503 });
  }
}
