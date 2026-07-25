# Arsitektur KasirKita

## Sumber data utama

Production tetap menggunakan satu state JSONB pada PostgreSQL di tabel
`kasirkita_app_state`. Semua mutasi penting memakai transaksi database dan
optimistic version sehingga permintaan bersamaan tidak saling menimpa.

Tabel `kasirkita_entities_v1` adalah projection terstruktur untuk pelaporan dan
migrasi bertahap. Tabel tersebut **bukan** sumber data utama dan boleh dibangun
ulang. Script projection melakukan staging, menghitung checksum, lalu mengganti
projection hanya jika jumlah baris dan checksum cocok.

## Keuangan

Field saldo lama tetap menjadi sumber tampilan saat transisi. Setiap penjualan,
void, pembayaran piutang, settlement withdrawal, dan subscription juga membuat
jurnal double-entry immutable di `financialLedgerEntries`. `journalKey` unik
mencegah callback atau retry payment mencatat uang dua kali.

## Batas kepercayaan

- Browser tidak pernah menerima secret Pakasir, Turnstile, encryption key, atau
  kredensial Redis.
- Status pembayaran hanya berubah setelah respons Pakasir cocok pada project,
  order ID, nominal, metode, dan status final.
- Checkout publik wajib lolos Turnstile dan shared rate limiting di production.
- Backup offsite dienkripsi AES-256-GCM, dibaca ulang, diverifikasi checksum, dan
  disimpan pada Blob private yang terpisah.

## Arah migrasi

Migrasi menuju tabel relasional dilakukan bertahap: projection tervalidasi,
dual-read, dual-write, rekonsiliasi, lalu cutover. Jangan menghapus state JSONB
sebelum minimal satu siklus backup, restore drill, dan rekonsiliasi lulus.
