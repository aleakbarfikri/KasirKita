# Setup Mac — tanpa Docker

Versi ini memakai SQLite lokal, jadi tidak perlu Docker Desktop.

```bash
cd /Users/macbook/Downloads/warung-digital-fullstack
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Jika ingin reset data:

```bash
npm run db:reset
```

Jika ingin lihat isi database:

```bash
npm run db:studio
```
