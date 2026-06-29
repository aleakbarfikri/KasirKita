# Backend KasirKita — SQLite + Prisma

Backend ini memakai Next.js API Route Handlers, Better Auth, Prisma Client, dan SQLite lokal.

Tidak perlu Docker dan tidak perlu PostgreSQL. Database akan dibuat di:

```txt
prisma/dev.db
```

## Setup

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

## Auth

Better Auth berjalan di:

```txt
/api/auth/[...all]
```

Login memakai username plugin:

```txt
Owner: ownerkasirkita / Regina050322
Admin dibuat oleh Owner dari aplikasi
```

## Database

Schema ada di:

```txt
prisma/schema.prisma
```

Seed ada di:

```txt
prisma/seed.ts
```

Lihat database lewat Prisma Studio:

```bash
npm run db:studio
```

## Notes

- Tidak ada Drizzle ORM.
- Tidak ada Docker Compose.
- Tidak ada koneksi PostgreSQL.
- Cocok untuk development lokal Mac karena SQLite hanya file lokal.
