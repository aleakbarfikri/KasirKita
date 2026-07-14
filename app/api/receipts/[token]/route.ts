import { buildReceipt, isReceiptToken } from "@/lib/server/receipt";
import { readDb } from "@/lib/server/data-store";

export async function GET(request: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  if (!isReceiptToken(params.token)) return Response.json({ ok: false, error: { message: "Struk tidak ditemukan." } }, { status: 404 });
  const db = await readDb();
  const transaction = db.transactions.find((row) => row.receiptToken === params.token);
  if (!transaction) {
    return Response.json({ ok: false, error: { message: "Struk tidak ditemukan" } }, { status: 404 });
  }

  return Response.json({
    ok: true,
    data: buildReceipt(db, transaction, new URL(request.url).origin),
  }, { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" } });
}
