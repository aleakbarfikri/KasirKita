import { authError, requireOwner } from "@/lib/server/auth-guard";
import { readBackup } from "@/lib/server/data-store";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireOwner();
    const backup = await readBackup(params.id);
    if (!backup) {
      return Response.json({ ok: false, error: { message: "Backup tidak ditemukan" } }, { status: 404 });
    }

    const filename = `${backup.info.id}.json`;
    return new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const { message, status } = authError(error);
    return Response.json({ ok: false, error: { message } }, { status });
  }
}
