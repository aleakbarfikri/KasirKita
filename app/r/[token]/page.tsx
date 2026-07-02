import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { readDb } from "@/lib/server/data-store";
import { buildReceipt, receiptPublicUrl } from "@/lib/server/receipt";
import { formatCurrency } from "@/lib/utils";

function shortInvoiceId(id?: string | null) {
  if (!id) return "-";
  const cleanId = id.replace(/^trx_/i, "");
  const shortId = cleanId.slice(0, 8).toUpperCase();
  return shortId ? `TRX-${shortId}` : "-";
}

export default async function DigitalReceiptPage({ params }: { params: { token: string } }) {
  const db = await readDb();
  const transaction = db.transactions.find((row) => row.receiptToken === params.token);
  if (!transaction) notFound();

  const publicUrl = receiptPublicUrl(params.token, process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL);
  const receipt = buildReceipt(db, transaction, process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL);
  const qr = publicUrl ? await QRCode.toDataURL(publicUrl, { margin: 1, width: 180 }) : "";

  return (
    <main className="min-h-screen bg-[#f8f9ff] p-4 text-[#0b1c30]">
      <section className="mx-auto max-w-md rounded-3xl border border-[#bccac0] bg-white p-6 shadow-xl">
        <div className="text-center">
          <h1 className="text-2xl font-black text-primary">{receipt.shop.name}</h1>
          {receipt.shop.address ? <p className="mt-1 text-sm text-[#3d4a42]">{receipt.shop.address}</p> : null}
          {receipt.shop.phone ? <p className="text-sm text-[#3d4a42]">{receipt.shop.phone}</p> : null}
        </div>

        <div className="my-5 border-t border-dashed border-[#bccac0]" />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>No Invoice</span><span className="font-bold">{shortInvoiceId(transaction.id)}</span></div>
          <div className="flex justify-between"><span>Tanggal</span><span>{new Date(transaction.createdAt).toLocaleString("id-ID")}</span></div>
          <div className="flex justify-between"><span>Kasir</span><span>{receipt.cashier.name}</span></div>
          <div className="flex justify-between"><span>Metode</span><span>{transaction.paymentMethod}</span></div>
        </div>

        <div className="my-5 border-t border-dashed border-[#bccac0]" />
        <div className="space-y-3">
          {receipt.items.map((item) => (
            <div key={`${item.sku}-${item.name}`} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-semibold">{item.name}</span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </div>
              <p className="text-xs text-[#3d4a42]">{item.quantity} x {formatCurrency(item.price)}</p>
            </div>
          ))}
        </div>

        <div className="my-5 border-t border-dashed border-[#bccac0]" />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-lg font-black"><span>Total</span><span>{formatCurrency(transaction.total)}</span></div>
          {transaction.paidAmount !== null && transaction.paidAmount !== undefined ? <div className="flex justify-between"><span>Dibayar</span><span>{formatCurrency(transaction.paidAmount)}</span></div> : null}
          {transaction.changeAmount !== null && transaction.changeAmount !== undefined ? <div className="flex justify-between"><span>Kembalian</span><span>{formatCurrency(transaction.changeAmount)}</span></div> : null}
        </div>

        {qr ? (
          <div className="mt-6 text-center">
            <img src={qr} alt="QR Struk Digital" className="mx-auto h-36 w-36" />
            <p className="mt-2 text-xs font-semibold text-[#3d4a42]">Simpan QR ini untuk membuka ulang struk.</p>
          </div>
        ) : null}
        <p className="mt-4 text-center text-xs text-[#3d4a42]">Terima kasih sudah berbelanja.</p>
      </section>
    </main>
  );
}
