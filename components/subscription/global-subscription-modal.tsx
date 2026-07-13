"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export function GlobalSubscriptionModal() {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<"monthly" | "yearly">("yearly");
  useEffect(() => { const handler = () => setOpen(true); window.addEventListener("kasirkita:open-subscription", handler); return () => window.removeEventListener("kasirkita:open-subscription", handler); }, []);
  const plans = [{ id: "free", name: "Free", price: "Gratis selamanya", features: "50 produk • 500 transaksi/bulan" }, { id: "pro", name: "Pro", price: period === "monthly" ? "Rp49.000 / bulan" : "Rp39.000 / bulan", features: "5.000 produk • 10.000 transaksi/bulan" }, { id: "business", name: "Business", price: period === "monthly" ? "Rp129.000 / bulan" : "Rp99.000 / bulan", features: "Unlimited • maksimal 5 cabang" }];
  return <Modal open={open} title="Paket KasirKita" description="Pilih paket yang sesuai kebutuhan toko Anda." onClose={() => setOpen(false)}>
    <div className="mb-5 flex justify-center"><div className="inline-flex rounded-full border border-[#d9e3de] bg-white p-1"><button type="button" onClick={() => setPeriod("monthly")} className={`rounded-full px-4 py-2 text-sm font-black ${period === "monthly" ? "bg-primary text-white" : "text-[#64748b]"}`}>Bulanan</button><button type="button" onClick={() => setPeriod("yearly")} className={`rounded-full px-4 py-2 text-sm font-black ${period === "yearly" ? "bg-primary text-white" : "text-[#64748b]"}`}>Tahunan</button></div></div>
    <div className="grid gap-3 sm:grid-cols-3">{plans.map((plan) => <div key={plan.id} className="flex min-h-44 flex-col rounded-2xl border border-[#d9e3de] bg-[#f8f9ff] p-4"><p className="text-lg font-black text-[#0b1c30]">{plan.name}</p><p className="mt-1 font-extrabold text-primary">{plan.price}</p><p className="mt-3 flex-1 text-sm font-semibold leading-relaxed text-[#3d4a42]">{plan.features}</p><Link href={plan.id === "free" ? "/admin" : `/admin?subscription=1&checkoutPlan=${plan.id}&billingPeriod=${period}`} onClick={() => setOpen(false)}><Button className="mt-4 w-full" size="sm">{plan.id === "free" ? "Gunakan Free" : "Pilih Paket"}</Button></Link></div>)}</div>
  </Modal>;
}
