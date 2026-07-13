"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BarChart3, CheckCircle2, Globe2, Package, ScanLine, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { setAppLanguage, useAppLanguage } from "@/lib/i18n";

const plans = [
  {
    id: "trial",
    name: "Free",
    priceKey: "Gratis selamanya",
    monthlyPriceKey: "Gratis selamanya",
    yearlyPriceKey: "Gratis selamanya",
    descriptionKey: "Untuk mulai digital tanpa biaya bulanan.",
    features: ["50 produk", "1 kasir", "500 transaksi/bulan", "POS kasir", "QRIS KasirKita", "Scan barcode SKU", "Cetak struk + watermark KasirKita", "Stok dan diskon dasar"],
    ctaKey: "Mulai Gratis",
  },
  {
    id: "pro",
    name: "Pro",
    priceKey: "Rp39.000 / bulan",
    monthlyPriceKey: "Rp49.000 / bulan",
    yearlyPriceKey: "Rp39.000 / bulan",
    descriptionKey: "Semua fitur utama dengan batas kapasitas yang nyaman.",
    features: ["5.000 produk", "5 kasir", "10.000 transaksi/bulan", "Semua fitur Free", "Import/export CSV", "QRIS KasirKita", "Hutang pelanggan", "Shift kasir", "Laporan omzet dan laba", "Backup dan restore"],
    ctaKey: "Daftar Pro",
  },
  {
    id: "business",
    name: "Business",
    priceKey: "Rp99.000 / bulan",
    monthlyPriceKey: "Rp129.000 / bulan",
    yearlyPriceKey: "Rp99.000 / bulan",
    descriptionKey: "Untuk bisnis dengan kapasitas unlimited dan hingga 5 cabang.",
    features: ["Produk unlimited", "Kasir unlimited", "Transaksi unlimited", "Maksimal 5 cabang", "Semua fitur Pro", "Backup otomatis", "Dashboard owner lintas cabang", "Log aktivitas", "Export laporan", "Prioritas support"],
    ctaKey: "Daftar Business",
  },
];

export function PricingPage() {
  const { language, t } = useAppLanguage();
  const [selectedPlan, setSelectedPlan] = useState("pro");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("yearly");
  const selected = plans.find((plan) => plan.id === selectedPlan) ?? plans[0];
  const registerHref = selected.id === "trial" ? "/register?plan=trial" : `/register?plan=${selected.id}&billingPeriod=${billingPeriod}`;

  return (
    <main className="min-h-screen bg-[#f7faf9] text-[#0b1c30]">
      <header className="sticky top-0 z-20 border-b border-[#d9e3de]/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <Image src="/kasirkita-mark.png" alt="KasirKita" width={44} height={44} className="h-11 w-11" />
            <span className="text-xl font-black text-primary">KasirKita</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-bold text-[#52645d] md:flex">
            <a href="#fitur" className="transition hover:text-primary">Fitur</a>
            <a href="#harga" className="transition hover:text-primary">Harga</a>
            <a href="#cara-kerja" className="transition hover:text-primary">Cara Kerja</a>
          </nav>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAppLanguage(language === "id" ? "en" : "id")} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#bccac0] bg-white px-4 text-sm font-bold text-[#0b1c30]">
              <Globe2 className="h-4 w-4 text-primary" />
              {language === "id" ? "EN" : "ID"}
            </button>
            <Link href="/login" className="rounded-full border border-primary px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/5">{t("Login")}</Link>
            <Link href="/register?plan=trial" className="hidden rounded-full bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-primary/90 sm:inline-flex">Coba Gratis</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-[#087a59] via-[#0b916d] to-[#0b6b57] text-white">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/15 blur-3xl" />
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-24">
          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold text-emerald-50"><Sparkles className="h-4 w-4" /> POS ringan untuk UMKM Indonesia</div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-tight sm:text-6xl">Kasir lebih cepat. Toko lebih tertata.</h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-emerald-50 sm:text-xl">Kelola penjualan, stok, hutang, QRIS, shift kasir, dan laporan dari satu aplikasi yang mudah dipakai.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register?plan=trial" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 font-black text-primary shadow-lg transition hover:-translate-y-0.5">Mulai Gratis <ArrowRight className="h-5 w-5" /></Link>
              <a href="#fitur" className="inline-flex min-h-13 items-center justify-center rounded-xl border border-white/40 px-6 py-3 font-black text-white transition hover:bg-white/10">Lihat Fitur</a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-emerald-50"><span>✓ Tanpa kartu kredit</span><span>✓ Setup cepat</span><span>✓ Bisa offline untuk POS</span></div>
          </div>
          <div className="relative grid grid-cols-2 gap-4">
            {[{ icon: WalletCards, title: "POS cepat", text: "Transaksi tunai, QRIS, dan hutang." }, { icon: Package, title: "Stok rapi", text: "Pantau produk dan stok minimum." }, { icon: ScanLine, title: "Scan SKU", text: "Input barcode langsung dari kamera." }, { icon: BarChart3, title: "Laporan jelas", text: "Omzet, laba, dan aktivitas toko." }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm"><Icon className="h-7 w-7 text-emerald-100" /><p className="mt-5 text-lg font-black">{title}</p><p className="mt-2 text-sm leading-relaxed text-emerald-50">{text}</p></div>)}
          </div>
        </div>
      </section>

      <section id="fitur" className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:px-8">
        <div className="max-w-2xl"><p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Semua yang dibutuhkan toko</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Dari transaksi pertama sampai laporan akhir hari.</h2><p className="mt-4 text-lg leading-relaxed text-[#64748b]">Fitur KasirKita dirancang untuk alur kerja pemilik toko dan kasir sehari-hari.</p></div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[{ icon: WalletCards, title: "Kasir & pembayaran", text: "Tunai, QRIS statis, QRIS dinamis, struk, dan transaksi hutang." }, { icon: Package, title: "Inventaris", text: "SKU, barcode, harga modal, diskon, stok, import, dan export." }, { icon: ShieldCheck, title: "Kontrol owner", text: "Admin, kasir, approval, shift, audit log, dan hak akses." }, { icon: BarChart3, title: "Insight usaha", text: "Omzet, laba kotor, piutang, withdrawal, dan backup data." }].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-2xl border border-[#dce8e2] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)]"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-primary"><Icon className="h-6 w-6" /></div><h3 className="mt-5 text-xl font-black">{title}</h3><p className="mt-2 text-sm font-medium leading-relaxed text-[#64748b]">{text}</p></div>)}
        </div>
      </section>

      <section id="cara-kerja" className="bg-[#0f1f2d] text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:py-16 lg:grid-cols-3 lg:px-8">
          {["Daftar toko", "Masukkan produk", "Mulai jualan"].map((title, index) => <div key={title} className="flex gap-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400 font-black text-[#0f1f2d]">{index + 1}</div><div><h3 className="text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-300">{index === 0 ? "Buat akun dan pilih paket sesuai kebutuhan usaha." : index === 1 ? "Tambah produk manual, import CSV, atau scan barcode." : "Terima pembayaran dan pantau toko dari dashboard."}</p></div></div>)}
        </div>
      </section>

      <section id="harga" className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">{t("Paket KasirKita")}</p>
          <h1 className="mt-3 text-4xl font-black tracking-normal sm:text-5xl">{t("Pilih paket sesuai ukuran UMKM.")}</h1>
          <p className="mt-4 text-lg font-semibold leading-relaxed text-[#3d4a42]">{t("Mulai dengan paket Free permanen, lalu upgrade saat toko butuh fitur yang lebih lengkap.")}</p>
        </div>

        <div className="mt-8 flex justify-center"><div className="inline-flex rounded-full border border-[#d9e3de] bg-white p-1 shadow-sm"><button type="button" onClick={() => setBillingPeriod("monthly")} className={`rounded-full px-5 py-2 text-sm font-black ${billingPeriod === "monthly" ? "bg-primary text-white" : "text-[#64748b]"}`}>Bulanan</button><button type="button" onClick={() => setBillingPeriod("yearly")} className={`rounded-full px-5 py-2 text-sm font-black ${billingPeriod === "yearly" ? "bg-primary text-white" : "text-[#64748b]"}`}>Tahunan <span className="ml-1 text-xs opacity-80">hemat</span></button></div></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <button key={plan.name} type="button" onClick={() => setSelectedPlan(plan.id)} className={`${plan.id === "pro" ? "border-2 border-primary bg-emerald-50 shadow-[0_18px_40px_rgba(0,105,72,0.12)]" : "border border-[#d9e3de] bg-white"} ${selectedPlan === plan.id ? "ring-2 ring-primary ring-offset-2" : ""} flex h-full flex-col rounded-2xl p-5 text-left transition hover:-translate-y-1 hover:border-primary hover:shadow-[0_18px_40px_rgba(11,28,48,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`} aria-pressed={selectedPlan === plan.id}>
              <div className="min-h-[128px]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black">{plan.name}</h2>
                  <div className="flex flex-col items-end gap-2">
                    {plan.id === "pro" ? <span className="rounded-full bg-primary px-3 py-1 text-xs font-black uppercase text-white">{t("Best Value")}</span> : null}
                    {selectedPlan === plan.id ? <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black uppercase text-sky-800">{t("Dipilih")}</span> : null}
                  </div>
                </div>
                <p className="mt-2 text-xl font-black text-primary">{t(plan.id === "pro" || plan.id === "business" ? (billingPeriod === "monthly" ? plan.monthlyPriceKey : plan.yearlyPriceKey) : plan.priceKey)}</p>
                <p className="mt-3 text-sm font-semibold leading-relaxed text-[#3d4a42]">{t(plan.descriptionKey)}</p>
              </div>
              <ul className="mt-5 space-y-2 text-sm font-semibold">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{t(feature)}</span>
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-[#d9e3de] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[#3d4a42]">{t("Paket dipilih")}</p>
            <p className="text-xl font-black text-[#0b1c30]">{selected.name} • {t(selected.id === "pro" || selected.id === "business" ? (billingPeriod === "monthly" ? selected.monthlyPriceKey : selected.yearlyPriceKey) : selected.priceKey)}</p>
          </div>
          <Link href={registerHref} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-black text-white hover:bg-primary/90">
            {t(selected.ctaKey)}
          </Link>
        </div>
      </section>
      <footer className="border-t border-[#d9e3de] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm font-semibold text-[#64748b] sm:flex-row sm:items-center sm:justify-between lg:px-8"><p>© {new Date().getFullYear()} KasirKita. Kasir digital untuk UMKM.</p><div className="flex gap-5"><Link href="/login" className="hover:text-primary">Login</Link><Link href="/register?plan=trial" className="hover:text-primary">Mulai Gratis</Link></div></div></footer>
    </main>
  );
}
