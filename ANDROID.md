# KasirKita Android

KasirKita Android menggunakan Trusted Web Activity (TWA). Aplikasi membuka PWA
resmi di `https://www.kasir-kita.com` dan hanya mempercayai domain tersebut
melalui Digital Asset Links.

## Identitas aplikasi

- Package ID: `com.kasirkita.pos`
- Start URL: `https://www.kasir-kita.com/admin/pos`
- Minimum Android: API 21
- Target Android: API 36

## Build lokal

Toolchain yang digunakan adalah Bubblewrap dan JDK 17. Dari folder `android`:

```bash
npx --yes @bubblewrap/cli@latest build
```

Kunci penandatanganan dan hasil build sengaja tidak masuk Git. Jangan pernah
menyimpan password atau file keystore di repository.

## Digital Asset Links

Konfigurasi domain berada di `public/.well-known/assetlinks.json`. Fingerprint
yang ada sekarang adalah fingerprint build pengujian. Sebelum rilis Play Store,
tambahkan fingerprint **App signing certificate** dari Play Console ke daftar
`sha256_cert_fingerprints` tanpa menghapus fingerprint yang masih digunakan
untuk pengujian.

## Checklist sebelum Play Store

1. Buat dan simpan upload key produksi di password manager serta backup offline.
2. Aktifkan Play App Signing dan tambahkan fingerprint sertifikat Play ke
   Digital Asset Links.
3. Uji login, kamera/barcode, notifikasi, offline cache, checkout, dan printer
   Bluetooth pada perangkat Android fisik.
4. Integrasikan Google Play Billing untuk langganan digital Pro/Business pada
   distribusi Play Store. Pembayaran barang fisik dari toko online tetap dapat
   menggunakan QRIS.
5. Isi Data safety, privacy policy, account deletion, content rating, screenshot,
   dan closed testing di Play Console.
