import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "KasirKita POS",
  description: "Aplikasi kasir UMKM untuk POS, inventaris, transaksi, hutang, QRIS, shift kasir, backup, dan laporan.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/kasirkita-mark.png",
    apple: "/kasirkita-mark.png",
  },
  appleWebApp: {
    capable: true,
    title: "KasirKita POS",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#006948",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
