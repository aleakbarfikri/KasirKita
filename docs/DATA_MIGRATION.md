# Runbook Migrasi Data

1. Buat backup manual Owner dan backup offsite terenkripsi.
2. Simpan snapshot Git dari commit production aktif.
3. Jalankan seluruh test, build, secret scan, dan audit dependency.
4. Jalankan migration projection terlebih dahulu pada database staging.
5. Verifikasi jumlah baris dan checksum pada `kasirkita_normalization_runs`.
6. Bandingkan total transaksi, omzet, saldo, piutang, dan jumlah tenant.
7. Ulangi pada production di maintenance window dengan
   `CONFIRM_NORMALIZED_MIGRATION=yes`.
8. Pantau error dan payment reconciliation minimal 24 jam.

Script `db:migrate:normalized` tidak mengubah `kasirkita_app_state`. Bila proses
gagal sebelum verifikasi, transaksi projection dibatalkan otomatis.

## Rollback

Karena projection bukan sumber utama, rollback tahap ini cukup menghentikan
pembacaan projection atau mengosongkan projection. Jangan restore production
tanpa lebih dahulu membuat backup `before-restore`.
