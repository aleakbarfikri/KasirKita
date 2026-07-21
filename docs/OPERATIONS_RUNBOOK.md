# Runbook Operasional

## Pemeriksaan harian

- `/api/health` harus mengembalikan status healthy.
- Cron backup dan payment reconciliation harus sukses.
- Tidak boleh ada lonjakan status 5xx, payment mismatch, atau Redis unavailable.
- Cek backup terakhir di Dashboard Owner dan Blob private.

## Restore drill bulanan

1. Unduh satu backup ke mesin aman.
2. Jalankan `npm run backup:verify -- /path/backup.json`.
3. Pastikan checksum valid, seluruh array wajib ada, Owner tersedia, dan ledger
   seimbang.
4. Restore hanya ke database staging terisolasi.
5. Login dengan akun staging, cek transaksi, produk, saldo, dan struk.
6. Catat waktu pemulihan dan hapus staging setelah selesai.

## Alert

Isi `KASIRKITA_ALERT_WEBHOOK_URL` untuk menerima insiden backup atau batch
rekonsiliasi gagal. Payload telah disanitasi dan tidak berisi password, cookie,
token, API key, atau stack production. Endpoint alert harus memakai HTTPS dan
aksesnya dibatasi untuk tim operasi.

## Insiden payment

Jangan mengubah status menjadi paid secara manual hanya berdasarkan bukti foto.
Bandingkan order ID, nominal, project, metode, dan status pada Pakasir. Bila
provider tidak dapat dijangkau, biarkan invoice pending dan ulangi rekonsiliasi.
