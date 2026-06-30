# KasirKita

KasirKita adalah aplikasi POS (Point of Sale) berbasis web untuk membantu UMKM mengelola penjualan, produk, admin cabang, pembayaran, hutang pelanggan, withdrawal, dan laporan transaksi.

Aplikasi ini dibuat dengan Next.js App Router dan dapat dijalankan secara lokal maupun dideploy ke Vercel.

## Fitur Utama

- Login Owner dan Admin
- Role guard untuk Owner dan Admin
- Dashboard Owner
- Manajemen Admin UMKM
- Manajemen produk dan inventaris
- Edit produk, SKU/barcode, harga, harga modal, stok, dan foto
- POS kasir untuk transaksi penjualan
- Quick POS dari halaman utama
- Tambah item manual yang belum ada di inventaris
- Pembayaran tunai
- QRIS statis
- QRIS Pakasir API
- Transaksi hutang pelanggan
- Buku hutang Admin
- Monitoring hutang oleh Owner
- Request withdrawal oleh Admin
- Approval withdrawal oleh Owner
- Export laporan CSV dari Dashboard Owner
- Ganti password Owner dari Dashboard Owner

## Tech Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Next.js API Route Handlers
- Signed HTTP-only cookie session
- JSON data store untuk local development
- Redis/KV untuk production di Vercel
- QRCode

## Struktur Project

```txt
app/              Halaman utama, route dashboard, dan API routes
components/       Komponen UI
lib/              Client helper dan server utility
lib/server/       Auth guard, data store, validator, formatter, dan helper backend
scripts/          Script setup/reset database
public/           Asset publik
```

## Cara Menjalankan di Lokal

Pastikan Node.js sudah terinstall.

```bash
npm install
cp .env.example .env.local
```

Isi atau sesuaikan environment variable lokal:

```env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
KASIRKITA_AUTH_SECRET="ganti-dengan-random-string-yang-panjang"
```

Generate secret yang aman:

```bash
openssl rand -base64 32
```

Reset dan seed database lokal:

```bash
npm run db:setup
```

Jalankan development server:

```bash
npm run dev
```

Buka aplikasi:

```txt
http://localhost:3000
http://localhost:3000/login
```

## Akun Owner

Akun Owner awal dibuat otomatis saat database kosong.

Untuk keamanan, credential akun tidak ditulis di README. Jangan pernah menaruh username, password, token, API key, atau secret production di repository publik.

Sebelum deploy production, pastikan credential Owner bawaan sudah diganti dan gunakan secret environment yang kuat.

## Ganti Password Owner

Setelah login sebagai Owner, buka Dashboard Owner lalu gunakan kartu **Ganti Password Owner**.

Password baru minimal 8 karakter. Setelah berhasil diganti, logout lalu login ulang menggunakan password baru.

## Perintah NPM

```bash
npm run dev       # menjalankan development server
npm run build     # build production
npm run start     # menjalankan production server
npm run lint      # menjalankan lint
npm run db:setup  # reset/seed data store lokal atau cloud
npm run db:reset  # reset ulang data store
```

## Storage / Database

KasirKita menggunakan JSON data store.

Untuk local development, data disimpan sebagai file lokal:

```txt
.data/kasirkita-db.json
```

Untuk production di Vercel, gunakan Redis/KV agar data tetap persisten antar serverless function.

Environment variable yang didukung:

```env
KASIRKITA_AUTH_SECRET="random-secret"
KV_REST_API_URL="..."
KV_REST_API_TOKEN="..."
```

Atau gunakan official Redis integration dari Vercel:

```env
REDIS_URL="..."
```

Jika Redis/KV belum diset di production, aplikasi bisa fallback ke file runtime sementara, tetapi penyimpanan seperti ini tidak disarankan untuk production karena data bisa tidak konsisten atau hilang.

## Deploy ke Vercel

1. Push project ke GitHub.
2. Import repository ke Vercel.
3. Tambahkan environment variable production:
   - `KASIRKITA_AUTH_SECRET`
   - `KV_REST_API_URL` dan `KV_REST_API_TOKEN`, atau
   - `REDIS_URL`
4. Redeploy project.
5. Login sebagai Owner.
6. Ganti password Owner dari Dashboard Owner.
7. Buat Admin UMKM dari dashboard Owner.
8. Login sebagai Admin untuk mulai mengelola produk dan transaksi.

## Endpoint Utama

```txt
/api/auth/[...all]
/api/me
/api/products
/api/products/:id
/api/pos/checkout
/api/transactions
/api/withdrawals
/api/debts
/api/owner/admins
/api/owner/change-password
/api/owner/payment-config
/api/owner/withdrawals
/api/owner/debts
/api/owner/report
/api/pakasir/status/:reference
```

## Flow Penggunaan

1. Owner login ke dashboard.
2. Owner mengganti password awal.
3. Owner membuat Admin UMKM.
4. Admin login ke dashboard kasir.
5. Admin menambahkan produk ke inventaris.
6. Admin melakukan checkout transaksi dari POS.
7. Transaksi bisa dibayar tunai, QRIS statis, QRIS Pakasir, atau dicatat sebagai hutang.
8. Owner dapat memantau admin, hutang, withdrawal, dan laporan transaksi.

## Catatan Keamanan

- Jangan commit file `.env` atau `.env.local`.
- Jangan publish credential akun.
- Jangan publish API key Pakasir.
- Jangan publish Redis/KV token.
- Gunakan `KASIRKITA_AUTH_SECRET` yang panjang dan random.
- Jika credential pernah terlanjur dipublikasikan, segera ganti password dan redeploy.
- Untuk production, pastikan data store sudah memakai Redis/KV.

## Status

Project ini masih dalam tahap pengembangan dan bisa terus disesuaikan untuk kebutuhan UMKM, toko, cabang, kasir, dan payment flow yang lebih lengkap.
