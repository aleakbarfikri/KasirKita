import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KasirKita POS",
  description: "KasirKita POS UMKM dengan Owner/Admin dashboard, QRIS, withdrawal, inventaris, dan buku hutang.",
  icons: { icon: "/kasirkita-mark.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
