import { readDb } from "@/lib/server/data-store";
import { generateReceiptPdf } from "@/lib/server/receipt-pdf";
import { buildReceipt, isReceiptToken } from "@/lib/server/receipt";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  if (!isReceiptToken(token)) return new Response("Struk tidak ditemukan.", { status: 404 });
  const [tokenLimit, ipLimit] = await Promise.all([
    enforceRateLimit(request, "receipt-pdf-token", { limit: 20, windowMs: 60_000 }, token),
    enforceRateLimit(request, "receipt-pdf-ip", { limit: 60, windowMs: 60_000 }),
  ]);
  if (!tokenLimit.allowed || !ipLimit.allowed) return new Response("Terlalu banyak unduhan. Coba lagi sebentar.", { status: 429 });
  const db = await readDb();
  const transaction = db.transactions.find((row) => row.receiptToken === token);
  if (!transaction) return new Response("Struk tidak ditemukan.", { status: 404 });

  const receipt = buildReceipt(db, transaction, new URL(request.url).origin);
  const pdf = await generateReceiptPdf(receipt);
  const invoice = receipt.transaction.invoiceNumber.replace(/[^A-Za-z0-9-]/g, "");
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="struk-${invoice}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
