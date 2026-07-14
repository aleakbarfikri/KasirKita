"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, QrCode } from "lucide-react";
import { api, type SubscriptionInvoiceRecord } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type PaidPlan = "pro" | "business";

export function GlobalSubscriptionModal() {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan | null>(null);
  const [invoice, setInvoice] = useState<SubscriptionInvoiceRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => { setOpen(true); setError(null); setMessage(null); };
    window.addEventListener("kasirkita:open-subscription", handler);
    return () => window.removeEventListener("kasirkita:open-subscription", handler);
  }, []);

  const plans = [
    { id: "free" as const, name: "Free", price: "Gratis selamanya", features: "50 produk • 500 transaksi/bulan" },
    { id: "pro" as const, name: "Pro", price: period === "monthly" ? "Rp49.000 / bulan" : "Rp39.000 / bulan", features: "5.000 produk • 10.000 transaksi/bulan" },
    { id: "business" as const, name: "Business", price: period === "monthly" ? "Rp129.000 / bulan" : "Rp99.000 / bulan", features: "Unlimited • maksimal 5 cabang" },
  ];

  async function checkout(plan: PaidPlan) {
    setSelectedPlan(plan); setBusy(true); setError(null); setMessage(null); setInvoice(null);
    try {
      const result = await api.subscription.checkout({ planType: plan, billingPeriod: period });
      setInvoice(result.invoice);
      setMessage("Invoice berhasil dibuat. Scan QRIS di bawah atau buka pembayaran Pakasir.");
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal membuat pembayaran subscription."); }
    finally { setBusy(false); }
  }

  async function checkPayment() {
    if (!invoice) return;
    setBusy(true); setError(null);
    try {
      const result = await api.subscription.poll(invoice.id);
      setInvoice(result.invoice);
      setMessage(result.invoice.status === "paid" ? "Pembayaran berhasil. Paket telah aktif." : "Pembayaran belum diterima. Selesaikan pembayaran lalu cek kembali.");
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal memeriksa pembayaran."); }
    finally { setBusy(false); }
  }

  return <Modal open={open} title="Paket & Pembayaran KasirKita" description="Pilih paket, bayar, dan cek status tanpa meninggalkan halaman ini." onClose={() => setOpen(false)}>
    <div className="space-y-5">
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {!invoice ? <>
        <div className="flex justify-center"><div className="inline-flex rounded-full border border-[#d9e3de] bg-white p-1"><button type="button" onClick={() => setPeriod("monthly")} className={`rounded-full px-4 py-2 text-sm font-black ${period === "monthly" ? "bg-primary text-white" : "text-[#64748b]"}`}>Bulanan</button><button type="button" onClick={() => setPeriod("yearly")} className={`rounded-full px-4 py-2 text-sm font-black ${period === "yearly" ? "bg-primary text-white" : "text-[#64748b]"}`}>Tahunan</button></div></div>
        <div className="grid gap-3 sm:grid-cols-3">{plans.map((plan) => <div key={plan.id} className={`flex min-h-48 flex-col rounded-2xl border p-4 ${selectedPlan === plan.id ? "border-primary bg-emerald-50" : "border-[#d9e3de] bg-[#f8f9ff]"}`}><p className="text-lg font-black text-[#0b1c30]">{plan.name}</p><p className="mt-1 font-extrabold text-primary">{plan.price}</p><p className="mt-3 flex-1 text-sm font-semibold leading-relaxed text-[#3d4a42]">{plan.features}</p>{plan.id === "free" ? <Button className="mt-4 w-full" size="sm" variant="outline" onClick={() => setOpen(false)}>Paket Saat Ini</Button> : <Button className="mt-4 w-full" size="sm" onClick={() => checkout(plan.id)} disabled={busy}>{busy && selectedPlan === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Bayar Sekarang</Button>}</div>)}</div>
      </> : <div className="rounded-2xl border border-[#d9e3de] bg-white p-5 text-center">
        {invoice.status === "paid" ? <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /> : <QrCode className="mx-auto h-10 w-10 text-primary" />}
        <p className="mt-3 text-xl font-black capitalize">Paket {invoice.planType}</p>
        <p className="mt-1 font-bold text-primary">{formatCurrency(invoice.totalPayment || invoice.amount)}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">Status: {invoice.status === "paid" ? "Lunas" : invoice.status === "expired" ? "Kedaluwarsa" : "Menunggu pembayaran"}</p>
        {invoice.status === "pending" && invoice.expiredAt ? <p className="mt-2 text-xs font-bold text-amber-700">Selesaikan sebelum {new Date(invoice.expiredAt).toLocaleString("id-ID")}. Maksimal pembayaran 1 jam.</p> : null}
        {invoice.qrImageDataUrl && invoice.status !== "paid" ? <img src={invoice.qrImageDataUrl} alt="QRIS pembayaran subscription" className="mx-auto mt-4 h-56 w-56 rounded-2xl border object-contain" /> : null}
        <div className="mt-4 grid gap-2">
          {invoice.paymentUrl && invoice.status !== "paid" ? <a href={invoice.paymentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-xl border border-primary px-4 py-3 text-sm font-bold text-primary"><ExternalLink className="mr-2 h-4 w-4" />Buka Pembayaran Pakasir</a> : null}
          {invoice.status === "pending" ? <Button onClick={checkPayment} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Cek Pembayaran</Button> : null}
          <Button variant="outline" onClick={() => { setInvoice(null); setSelectedPlan(null); setMessage(null); }}>Pilih Paket Lain</Button>
        </div>
      </div>}
    </div>
  </Modal>;
}
