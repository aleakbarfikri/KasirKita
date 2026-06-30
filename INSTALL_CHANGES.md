# Cara Pakai ZIP Ini

ZIP ini berisi file perubahan untuk menambahkan fitur **Ganti Password Owner** di KasirKita.

## Cara pasang

1. Extract ZIP ini.
2. Copy semua isi folder `KasirKita-change-password` ke root repo `KasirKita` kamu.
3. Kalau muncul pilihan replace file, pilih replace untuk:
   - `README.md`
   - `components/dashboard/owner-dashboard-client.tsx`
4. Pastikan file baru ini ikut masuk:
   - `app/api/owner/change-password/route.ts`
   - `components/dashboard/owner-change-password-card.tsx`
5. Commit ke GitHub:

```bash
git add .
git commit -m "feat: add owner change password"
git push
```

Vercel akan redeploy otomatis kalau project sudah tersambung ke GitHub.

## Setelah deploy

1. Login sebagai Owner.
2. Buka Dashboard Owner.
3. Isi kartu **Ganti Password Owner**.
4. Logout.
5. Login ulang pakai password baru.

Catatan: ZIP ini bukan full clone repo, tapi file perubahan yang perlu ditimpa/ditambahkan ke repo kamu.
