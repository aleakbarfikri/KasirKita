"use client";

import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Globe2 } from "lucide-react";
import { setAppLanguage, useAppLanguage } from "@/lib/i18n";

const plans = [
  {
    name: "Trial",
    priceKey: "Gratis 14 hari",
    descriptionKey: "Coba dulu POS dasar sebelum memilih paket.",
    features: ["100 produk", "1 kasir", "500 transaksi/bulan", "Diskon aktif", "Struk thermal dasar"],
    ctaKey: "Mulai Trial",
    href: "/register",
  },
  {
    name: "Basic",
    priceKey: "Rp100.000 / tahun",
    descriptionKey: "Untuk toko kecil yang butuh kasir digital sederhana.",
    features: ["300 produk", "1 kasir", "500 transaksi/bulan", "POS, inventaris, diskon, dan struk thermal dasar", "QRIS statis manual"],
    ctaKey: "Daftar Basic",
    href: "/register",
  },
  {
    name: "Starter",
    priceKey: "Rp19.000 / bulan",
    descriptionKey: "Paket masuk bulanan dengan kapasitas lebih lega.",
    features: ["500 produk", "1 kasir", "1.000 transaksi/bulan", "POS, inventaris, diskon, QRIS statis, dan riwayat transaksi"],
    ctaKey: "Daftar Starter",
    href: "/register",
    featured: true,
  },
  {
    name: "Pro",
    priceKey: "Rp49.000 / bulan",
    descriptionKey: "Untuk UMKM yang butuh pembayaran dan operasional lebih lengkap.",
    features: ["1.000 produk", "3 kasir", "3.000 transaksi/bulan", "Import/export, diskon, QRIS Pakasir, hutang, dan shift", "Laporan omzet dan laba"],
    ctaKey: "Daftar Pro",
    href: "/register",
  },
  {
    name: "Business",
    priceKey: "Rp99.000 / bulan",
    descriptionKey: "Untuk toko yang butuh kapasitas besar dan prioritas support.",
    features: ["Produk tanpa batas", "Kasir tanpa batas", "Transaksi tanpa batas", "Semua fitur Pro aktif", "Backup otomatis dan prioritas support"],
    ctaKey: "Daftar Business",
    href: "/register",
  },
];

export function PricingPage() {
  const { language, t } = useAppLanguage();

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-[#0b1c30]">
      <header className="border-b border-[#d9e3de] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/login" className="flex min-w-0 items-center gap-3">
            <Image src="/kasirkita-mark.png" alt="KasirKita" width={44} height={44} className="h-11 w-11" />
            <span className="text-xl font-black text-primary">KasirKita</span>
          </Link>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setAppLanguage(language === "id" ? "en" : "id")} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#bccac0] bg-white px-4 text-sm font-bold text-[#0b1c30]">
              <Globe2 className="h-4 w-4 text-primary" />
              {language === "id" ? "EN" : "ID"}
            </button>
            <Link href="/login" className="hidden rounded-full border border-primary px-4 py-2 text-sm font-bold text-primary sm:inline-flex">{t("Login")}</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">{t("Paket KasirKita")}</p>
          <h1 className="mt-3 text-4xl font-black tracking-normal sm:text-5xl">{t("Pilih paket sesuai ukuran UMKM.")}</h1>
          <p className="mt-4 text-lg font-semibold leading-relaxed text-[#3d4a42]">{t("Mulai dari trial gratis, lalu upgrade saat toko butuh fitur yang lebih lengkap.")}</p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-5">
          {plans.map((plan) => (
            <div key={plan.name} className={plan.featured ? "rounded-2xl border-2 border-primary bg-emerald-50 p-5 shadow-[0_18px_40px_rgba(0,105,72,0.12)]" : "rounded-2xl border border-[#d9e3de] bg-white p-5"}>
              <div className="min-h-[128px]">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-black">{plan.name}</h2>
                  {plan.featured ? <span className="rounded-full bg-primary px-3 py-1 text-xs font-black uppercase text-white">{t("Best Value")}</span> : null}
                </div>
                <p className="mt-2 text-xl font-black text-primary">{t(plan.priceKey)}</p>
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
              <Link href={plan.href} className={plan.featured ? "mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-black text-white hover:bg-primary/90" : "mt-6 inline-flex w-full items-center justify-center rounded-xl border border-primary bg-white px-4 py-3 text-sm font-black text-primary hover:bg-primary/5"}>
                {t(plan.ctaKey)}
              </Link>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
