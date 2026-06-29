# KasirKita Fullstack — SQLite Version

Aplikasi POS KasirKita dengan frontend Next.js, API Route Handlers, Better Auth, dan database lokal SQLite.

Versi ini **tidak memakai Drizzle, PostgreSQL, atau Docker**. Database tersimpan sebagai file lokal:

```txt
prisma/dev.db
```

## Tech Stack

- Next.js App Router
- Tailwind CSS
- shadcn-style local components
- Next.js API Route Handlers
- Better Auth + username login
- Prisma Client
- SQLite lokal

## Cara menjalankan

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Buka:

```txt
http://localhost:3000
http://localhost:3000/login
```

## Akun awal

```txt
Owner:
username: ownerkasirkita
password: Regina050322
```

Database awal hanya berisi akun Owner. Buat admin UMKM dari menu Owner → Admin Management, lalu login sebagai admin tersebut untuk menambah produk dan transaksi.

## Perintah database

```bash
npm run db:setup   # reset SQLite lokal + generate Prisma client + push schema + seed owner
npm run db:reset   # hapus prisma/dev.db lalu setup ulang
npm run db:studio  # buka Prisma Studio untuk melihat/edit database
```

## Endpoint utama

```txt
/api/auth/[...all]
/api/me
/api/products
/api/pos/checkout
/api/transactions
/api/withdrawals
/api/debts
/api/owner/admins
/api/owner/payment-config
/api/owner/withdrawals
/api/owner/debts
/api/pakasir/status/:reference
```

## Fitur

- Login Owner/Admin dengan Better Auth username plugin
- Role guard Owner/Admin
- CRUD produk + foto opsional
- POS checkout tunai, QRIS statis, QRIS Pakasir API, dan hutang
- Buku hutang admin + monitoring owner
- Withdrawal admin + approval owner
- Payment config owner
- Semua data backend masuk ke SQLite lokal

## Update POS Kasir

Halaman `/admin/pos` sudah mendukung:

- Tombol **Add Item** untuk item manual yang belum ada di inventaris.
- Input nama item, SKU opsional, harga per item, dan quantity.
- Perhitungan otomatis `harga per item × quantity` untuk subtotal setiap item.
- Total keranjang otomatis menjumlahkan semua subtotal item.
- Item manual tetap ikut tersimpan ke transaksi backend melalui `/api/pos/checkout`.

## Update Homepage + POS Payment Panel

Versi ini juga menambahkan:

- Quick POS di halaman utama `/` yang sudah memakai backend:
  - mengambil produk dari `/api/products`
  - cari barang berdasarkan nama/SKU
  - tambah barang ke keranjang dari homepage
  - Add Item manual dari homepage
  - opsi simpan item manual ke inventaris backend
  - checkout payment dari homepage ke `/api/pos/checkout`
- Payment panel di `/admin/pos` selalu terlihat, tidak hanya di layar besar.
- Quantity `+ / - / input` menghitung subtotal `harga × qty` dan total transaksi otomatis.

## Update Owner Admin + Laporan

Versi ini memperbaiki:

- Form **Tambahkan Admin UMKM** tidak lagi memunculkan error generik `Invalid admin payload` untuk username dengan spasi/tanda hubung.
- Username admin otomatis dinormalisasi ke format Better Auth yang valid: huruf kecil, angka, dan underscore.
- Error backend sekarang lebih jelas, misalnya email/username sudah digunakan atau password kurang panjang.
- Tombol **Unduh Laporan** di Dashboard Owner sekarang aktif dan mengunduh file CSV dari endpoint `/api/owner/report`.
- Laporan CSV berisi ringkasan pendapatan, admin cabang, transaksi, withdrawal, dan piutang/hutang pelanggan.

## Update Withdrawal Security

- Saat password admin salah di modal konfirmasi withdrawal, sekarang muncul notifikasi merah langsung di dalam modal.
- Input password diberi highlight merah sampai admin mengetik ulang password.
- Request withdrawal tidak dikirim ke Owner sampai password admin yang sedang login benar.

## Update inventory edit

Halaman `Admin > Inventaris` sekarang memiliki tombol **Edit** pada daftar produk. Admin dapat mengubah nama barang, SKU/barcode, harga jual, harga modal, dan stok melalui modal edit yang tersambung ke endpoint `PATCH /api/products/:id`. SKU tetap opsional; jika dikosongkan, backend membuat SKU otomatis.
## Vercel Redis official integration

This build supports both Upstash/KV REST variables (`KV_REST_API_URL` + `KV_REST_API_TOKEN`) and the official Redis integration variable (`REDIS_URL`). If Vercel creates only `REDIS_URL`, no extra code changes are needed. Redeploy after adding the variable.

