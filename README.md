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

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Next.js API Route Handlers
- Signed HTTP-only cookie session
- JSON data store untuk local development
- PostgreSQL untuk data utama production
- Redis untuk shared rate limiting dan proteksi checkout
- Blob private terenkripsi untuk backup offsite
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
KASIRKITA_BOOTSTRAP_OWNER_USERNAME="username_owner_unik"
KASIRKITA_BOOTSTRAP_OWNER_EMAIL="owner@example.com"
KASIRKITA_BOOTSTRAP_OWNER_PASSWORD="password-unik-minimal-12-karakter"
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

Akun Owner hanya dibuat saat database benar-benar kosong dan ketiga variabel
`KASIRKITA_BOOTSTRAP_OWNER_*` tersedia. Gunakan nilai unik, login satu kali,
kemudian hapus ketiga variabel bootstrap dan redeploy. Tidak ada username atau
password bawaan di source code.

## Ganti Password Owner

Setelah login sebagai Owner, buka Dashboard Owner lalu gunakan kartu **Ganti Password Owner**.

Password baru minimal 12 karakter. Setelah berhasil diganti, sesi lain dicabut dan pengguna login ulang menggunakan password baru.

## Perintah NPM

```bash
npm run dev       # menjalankan development server
npm run build     # build production
npm run start     # menjalankan production server
npm run lint      # menjalankan lint
npm run test      # unit dan integration test
npm run test:e2e  # smoke test browser Chromium
npm run db:setup  # reset/seed data store lokal atau cloud
npm run db:reset  # reset ulang data store
npm run backup:verify -- /path/backup.json
```

## Storage / Database

KasirKita memakai model aplikasi JSON yang disimpan sebagai JSONB PostgreSQL di
production. Projection relasional dan ledger keuangan ditambahkan secara
bertahap tanpa mengganti atau menghapus sumber data utama.

Untuk local development, data disimpan sebagai file lokal:

```txt
.data/kasirkita-db.json
```

Untuk production di Vercel, gunakan PostgreSQL sebagai sumber data utama:

Environment variable yang didukung:

```env
KASIRKITA_AUTH_SECRET="random-secret"
POSTGRES_URL="postgresql://..."
```

Redis tetap wajib untuk shared rate limiting checkout publik. Gunakan official
Redis integration dari Vercel atau kredensial REST Upstash:

```env
REDIS_URL="..."
# atau:
KV_REST_API_URL="..."
KV_REST_API_TOKEN="..."
```

Data production tidak boleh mengandalkan filesystem serverless. Endpoint checkout
publik gagal tertutup bila Redis tidak tersedia agar limit tidak dapat dilewati
antar-instance.

Untuk endpoint checkout toko online, Redis/KV bersifat wajib di production. Checkout akan mengembalikan status `503` jika penghitung bersama tidak tersedia agar proteksi spam tidak dapat dilewati antar-instance serverless.

Tambahkan juga Cloudflare Turnstile untuk checkout publik:

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY="site-key"
TURNSTILE_SECRET_KEY="secret-key"
TURNSTILE_ALLOWED_HOSTNAMES="kasir-kita.com,www.kasir-kita.com"
```

Token Turnstile divalidasi server-side dengan action `store_checkout`, hostname yang diizinkan, masa berlaku, dan sifat single-use dari Siteverify.

## Deploy ke Vercel

1. Push project ke GitHub.
2. Import repository ke Vercel.
3. Tambahkan environment variable production:
   - `KASIRKITA_AUTH_SECRET`
   - `POSTGRES_URL`
   - `KV_REST_API_URL` dan `KV_REST_API_TOKEN`, atau `REDIS_URL`
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - `TURNSTILE_SECRET_KEY`
   - `TURNSTILE_ALLOWED_HOSTNAMES`
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
2. Owner login menggunakan credential bootstrap satu kali, lalu variabel bootstrap dihapus dari environment production.
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
- Hapus seluruh variabel `KASIRKITA_BOOTSTRAP_OWNER_*` setelah bootstrap berhasil.
- Production akan menolak sesi jika auth secret hilang, terlalu pendek, atau masih berupa placeholder.
- Untuk production, pastikan data utama memakai PostgreSQL dan backup offsite
  terenkripsi berhasil diverifikasi.
- Ikuti runbook di `docs/OPERATIONS_RUNBOOK.md` dan `docs/DATA_MIGRATION.md`.

## Status

Project ini masih dalam tahap pengembangan dan bisa terus disesuaikan untuk kebutuhan UMKM, toko, cabang, kasir, dan payment flow yang lebih lengkap.
