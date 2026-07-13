import { buildReceipt } from "@/lib/server/receipt";
import { readDb } from "@/lib/server/data-store";

export async function GET(request: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const db = await readDb();
  const transaction = db.transactions.find((row) => row.receiptToken === params.token);
  if (!transaction) {
    return Response.json({ ok: false, error: { message: "Struk tidak ditemukan" } }, { status: 404 });
  }

  return Response.json({
    ok: true,
    data: buildReceipt(db, transaction, new URL(request.url).origin),
  });
}
