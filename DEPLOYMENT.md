# KasirKita Deployment Notes

## Build status

`npm run build` was run successfully in the prepared project. The build output completed with Next.js production routes for `/`, `/login`, `/owner`, `/admin`, and all API route handlers.

## Local setup

```bash
cp .env.example .env
npm install
npm run db:setup
npm run build
npm run start
```

Owner login after `db:setup`:

```txt
username: ownerkasirkita
password: Regina050322
```

## Vercel setup with production database

The app can run locally with a JSON file. For Vercel production, use Postgres so admin accounts, products, transactions, QRIS config, debts, and withdrawals persist across serverless functions.

1. Create a Postgres database in Neon, Supabase, or Vercel Storage.
2. Copy the pooled connection string.
3. Make sure these environment variables exist in Project Settings → Environment Variables:

```txt
POSTGRES_URL
KASIRKITA_AUTH_SECRET
```

`KASIRKITA_AUTH_SECRET` should be a random string. Generate locally with:

```bash
openssl rand -base64 32
```

4. Redeploy the project.

The first request will seed the owner automatically if the Postgres database is empty.

This version stores the application state in Postgres `jsonb` tables:

- `kasirkita_app_state`
- `kasirkita_backups`

That keeps the migration low-risk because existing API routes can keep using the same `readDb` / `writeDb` data layer. A later version can normalize this into dedicated SQL tables once traffic and reporting needs grow.

## Migrate local JSON data to Postgres

After setting `POSTGRES_URL` locally:

```bash
npm install
npm run db:migrate:production
```

By default, migration reads `.data/kasirkita-db.json`. To migrate another file:

```bash
KASIRKITA_MIGRATION_SOURCE="/path/to/kasirkita-db.json" npm run db:migrate:production
```

The script writes the data to Postgres and creates an initial backup snapshot.

## Backup and export

Owner dashboard includes:

- `Export CSV` for owner report downloads.
- `Buat Backup JSON` for full database snapshots.
- Download links for recent backups.

CLI backup:

```bash
npm run backup:create -- manual-before-release
```

Backups are stored in Postgres when `POSTGRES_URL` is configured. Local development stores backup files under `.data/backups`.

## GitHub public repository push

```bash
cd warung-digital-fullstack
git init
git add .
git commit -m "Initial KasirKita deployment-ready build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/KasirKita.git
git push -u origin main
```

## Notes

- Prisma/Drizzle are not required for this version.
- Local development uses `.data/kasirkita-db.json`.
- Vercel production should use Postgres through `POSTGRES_URL`.
- `/tmp` storage is not reliable for production because different serverless functions may not share the same files.
- Redis/KV is still supported as a fallback through `KV_REST_API_URL` + `KV_REST_API_TOKEN` or `REDIS_URL`, but Postgres is preferred for production.
