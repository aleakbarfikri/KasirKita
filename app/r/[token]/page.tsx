import QRCode from "qrcode";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readDb } from "@/lib/server/data-store";
import { buildReceipt, isReceiptToken, receiptPublicUrl } from "@/lib/server/receipt";
import { formatCurrency } from "@/lib/utils";
import { OnlineOrderReceiptStatus } from "@/components/receipts/online-order-receipt-status";

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

export default async function DigitalReceiptPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  if (!isReceiptToken(params.token)) notFound();
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
          {receipt.showWatermark ? <p className="mb-2 text-xs font-black tracking-[0.16em] text-primary">{receipt.watermarkText || "www.kasir-kita.com"}</p> : null}
          {receipt.settings.logoDataUrl ? <img src={receipt.settings.logoDataUrl} alt="Logo usaha" className="mx-auto mb-2 h-20 w-20 object-contain" /> : null}
          <h1 className="text-2xl font-black text-primary">{receipt.shop.name}</h1>
          {receipt.shop.address ? <p className="mt-1 text-sm text-[#3d4a42]">{receipt.shop.address}</p> : null}
          {receipt.shop.phone ? <p className="text-sm text-[#3d4a42]">{receipt.shop.phone}</p> : null}
        </div>

        <div className="my-5 border-t border-dashed border-[#bccac0]" />
        {receipt.onlineOrder ? <OnlineOrderReceiptStatus token={params.token} initialReceipt={receipt} /> : null}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>No Invoice</span><span className="font-bold">{receipt.transaction.invoiceNumber}</span></div>
          {receipt.queueNumber ? <div className="flex justify-between"><span>No. Antrean / Queue</span><span className="font-black">{receipt.queueNumber}</span></div> : null}
          <div className="flex justify-between"><span>Tanggal</span><span>{new Date(receipt.transaction.createdAt).toLocaleString("id-ID")}</span></div>
          <div className="flex justify-between"><span>Kasir</span><span>{receipt.cashier.name}</span></div>
          <div className="flex justify-between"><span>Metode</span><span>{receipt.transaction.paymentMethod === "qris_pakasir" ? "qris_kasirkita" : receipt.transaction.paymentMethod}</span></div>
        </div>

        <div className="my-5 border-t border-dashed border-[#bccac0]" />
        <div className="space-y-3">
          {receipt.items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-semibold">{item.name}</span>
                <span>{formatCurrency(item.subtotal ?? item.price * item.quantity)}</span>
              </div>
              <p className="text-xs text-[#3d4a42]">
                {item.quantity} x {formatCurrency(item.price)}
                {item.discountAmount ? ` • Diskon ${formatCurrency(item.discountAmount)} / item` : ""}
                {(item.subtotal ?? item.price * item.quantity) < item.price * item.quantity ? " • Harga paket" : ""}
              </p>
            </div>
          ))}
        </div>

        <div className="my-5 border-t border-dashed border-[#bccac0]" />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(receipt.transaction.subtotal ?? receipt.transaction.total)}</span></div>
          {receipt.transaction.discountAmount ? <div className="flex justify-between"><span>Diskon Transaksi</span><span>-{formatCurrency(receipt.transaction.discountAmount)}</span></div> : null}
          <div className="flex justify-between text-lg font-black"><span>Total</span><span>{formatCurrency(receipt.transaction.total)}</span></div>
          {receipt.transaction.paidAmount !== null && receipt.transaction.paidAmount !== undefined ? <div className="flex justify-between"><span>Dibayar</span><span>{formatCurrency(receipt.transaction.paidAmount)}</span></div> : null}
          {receipt.transaction.changeAmount !== null && receipt.transaction.changeAmount !== undefined ? <div className="flex justify-between"><span>Kembalian</span><span>{formatCurrency(receipt.transaction.changeAmount)}</span></div> : null}
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
