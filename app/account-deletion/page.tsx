import Link from "next/link";
import { LegalDocument } from "@/components/legal/legal-document";

export default function AccountDeletionPage() {
  return <LegalDocument title="Penghapusan Akun dan Data"><section><h2>Hapus langsung dari aplikasi</h2><p>Admin yang sedang login dapat membuka profil lalu memilih Hapus Akun, atau membuka halaman <Link href="/account/delete">penghapusan akun</Link>. Konfirmasi password diperlukan untuk mencegah penghapusan tanpa izin.</p></section><section><h2>Alternatif bantuan</h2><p>Jika tidak dapat login, kirim permintaan dari email akun terdaftar ke customercare@kasir-kita.com dengan subjek “Hapus Akun KasirKita”. Sertakan username dan nama toko, tetapi jangan sertakan password atau OTP.</p></section><section><h2>Data yang dihapus</h2><p>Akun admin dan kasir terkait, sesi, profil toko, produk, transaksi, hutang, shift, dan data langganan terkait akan dihapus permanen.</p></section></LegalDocument>;
}
