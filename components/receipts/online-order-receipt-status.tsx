"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, MessageCircle, PackageCheck } from "lucide-react";
import { apiFetch, type OnlineOrderStatus, type ReceiptRecord } from "@/lib/api-client";

const labels: Partial<Record<OnlineOrderStatus, string>> = {
  paid: "Pesanan diterima",
  processing: "Pesanan sedang diproses",
  ready: "Pesanan selesai dan siap diambil",
  completed: "Pesanan telah diambil",
};

function whatsapp(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

export function OnlineOrderReceiptStatus({ token, initialReceipt }: { token: string; initialReceipt: ReceiptRecord }) {
  const [receipt, setReceipt] = useState(initialReceipt);
  useEffect(() => {
    const refresh = async () => { try { setReceipt(await apiFetch<ReceiptRecord>(`/api/receipts/${token}`)); } catch { /* retry while this receipt is open */ } };
    const timer = window.setInterval(refresh, 10_000);
    return () => window.clearInterval(timer);
  }, [token]);
  if (!receipt.onlineOrder) return null;
  const status = receipt.onlineOrder.status;
  const complete = status === "ready" || status === "completed";
  const processing = status === "processing" || complete;
  const shopPhone = receipt.shop.phone;
  const message = `Halo ${receipt.shop.name}, saya sudah membayar pesanan online ${receipt.onlineOrder.orderNumber} (${receipt.transaction.invoiceNumber}) atas nama ${receipt.onlineOrder.customerName}. Mohon dicek, terima kasih.`;
  return <div className="mb-5 space-y-4 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-950">
    <div><p className="font-black uppercase tracking-wider">Pesanan Online</p><p className="mt-1 font-mono text-xs font-bold">Order ID: {receipt.onlineOrder.orderNumber}</p><p className="mt-2"><b>Pemesan:</b> {receipt.onlineOrder.customerName}</p><p><b>WhatsApp:</b> {receipt.onlineOrder.customerPhone}</p><p className="mt-1 text-xs">Ambil di toko</p></div>
    <div className="rounded-xl border border-emerald-200 bg-white p-4"><p className="font-black">Status: {labels[status] || "Menunggu konfirmasi"}</p><div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-bold"><span className="text-emerald-700"><CheckCircle2 className="mx-auto mb-1 h-5 w-5" />Diterima</span><span className={processing ? "text-emerald-700" : "text-slate-400"}><Clock3 className="mx-auto mb-1 h-5 w-5" />Diproses</span><span className={complete ? "text-emerald-700" : "text-slate-400"}><PackageCheck className="mx-auto mb-1 h-5 w-5" />Selesai</span></div><p className="mt-3 text-center text-[11px] text-slate-500">Status diperbarui otomatis setiap 10 detik.</p></div>
    {shopPhone ? <a href={`https://wa.me/${whatsapp(shopPhone)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3 font-black text-white"><MessageCircle className="mr-2 h-4 w-4" />Hubungi Toko</a> : null}
  </div>;
}
