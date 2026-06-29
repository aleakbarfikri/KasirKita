import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, NotebookTabs, QrCode, Store, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HomePosClient } from "@/components/home/home-pos-client";
import { getCurrentSession } from "@/lib/server/auth-guard";

const features = [
  { title: "POS Kasir Cepat", text: "Tampilan kasir modern dengan pencarian produk, add item manual, keranjang, dan checkout cepat.", icon: Store },
  { title: "QRIS Lengkap", text: "Tunai, QRIS statis owner, dan QRIS dinamis Pakasir dalam satu flow pembayaran.", icon: QrCode },
  { title: "Saldo & Withdrawal", text: "Admin bisa ajukan penarikan dari saldo QRIS Pakasir sukses dengan validasi password.", icon: Wallet },
  { title: "Buku Hutang", text: "Catat transaksi bayar nanti, data pelanggan, jatuh tempo, dan status pelunasan.", icon: NotebookTabs },
];

export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login?next=/");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8f9ff] text-[#0b1c30]">
      <section className="relative px-5 py-8 md:px-8 lg:px-16">
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#dae2fd]/80 blur-3xl" />
        <nav className="relative z-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/kasirkita-mark.png" alt="Logo KasirKita" className="h-14 w-14 object-contain" />
            <div>
              <p className="text-3xl font-extrabold text-primary">KasirKita</p>
                          </div>
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            <Link href="/owner"><Button variant="outline">Owner</Button></Link>
            <Link href="/admin/pos"><Button>Masuk Kasir</Button></Link>
          </div>
        </nav>

        <div className="relative z-10 grid min-h-[calc(100vh-110px)] items-center gap-10 py-12 lg:grid-cols-[1fr_560px]">
          <div>
            <div className="mb-8 max-w-[280px] rounded-[2rem] bg-white/70 p-5 shadow-sm ring-1 ring-[#bccac0]/60 backdrop-blur">
              <img src="/kasirkita-logo.png" alt="KasirKita" className="w-full object-contain" />
            </div>
            <h1 className="max-w-4xl text-4xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl md:text-6xl lg:text-6xl">
              KasirKita untuk UMKM, QRIS, dan Buku Hutang.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-[#3d4a42]">
              Kelola transaksi harian, tambah barang, cari produk, pembayaran tunai atau QRIS, withdrawal admin, dan pencatatan hutang pelanggan dalam satu dashboard.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/admin/pos"><Button size="lg">Buka Halaman Kasir <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
              <Link href="/owner"><Button size="lg" variant="outline">Dashboard Owner</Button></Link>
            </div>
          </div>

          <HomePosClient />
        </div>
      </section>

      <section className="grid gap-4 px-5 pb-14 md:grid-cols-2 md:px-8 lg:grid-cols-4 lg:px-16">
        {features.map((feature) => (
          <Card key={feature.title} className="bg-white">
            <CardContent className="p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dae2fd] text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <h2 className="font-extrabold">{feature.title}</h2>
              <p className="mt-2 text-sm text-[#3d4a42]">{feature.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
