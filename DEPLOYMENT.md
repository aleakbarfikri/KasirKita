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

No default Owner credential is included. Before `db:setup`, fill all required
`KASIRKITA_BOOTSTRAP_OWNER_*` variables with unique values. The bootstrap
password must contain at least 12 characters. Remove those variables after the
first successful Owner login.

## Vercel setup with production database

The app can run locally with a JSON file. For Vercel production, use Postgres so admin accounts, products, transactions, QRIS config, debts, and withdrawals persist across serverless functions.

1. Create a Postgres database in Neon, Supabase, or Vercel Storage.
2. Copy the pooled connection string.
3. Make sure these environment variables exist in Project Settings → Environment Variables:

```txt
POSTGRES_URL
KASIRKITA_AUTH_SECRET
KASIRKITA_DATA_ENCRYPTION_KEY
KASIRKITA_BOOTSTRAP_OWNER_USERNAME
KASIRKITA_BOOTSTRAP_OWNER_EMAIL
KASIRKITA_BOOTSTRAP_OWNER_PASSWORD
```

`KASIRKITA_AUTH_SECRET` should be a random string. Generate locally with:

```bash
openssl rand -base64 32
```

Generate `KASIRKITA_DATA_ENCRYPTION_KEY` separately with the same command. It
encrypts Pakasir/WhatsApp credentials and Owner MFA secrets. Keep a recovery
copy in a password manager or OS keychain. Do not reuse the auth or backup key.

4. Redeploy the project. Confirm that the Owner can log in, remove all three
   bootstrap variables, and redeploy again.

The first request seeds the Owner only when the database is empty and the three
required bootstrap variables are configured. Existing databases are never
overwritten by bootstrap values.

This version stores the application state in Postgres `jsonb` tables:

- `kasirkita_app_state`
- `kasirkita_backups`

That keeps the migration low-risk because existing API routes can keep using the same `readDb` / `writeDb` data layer. A later version can normalize this into dedicated SQL tables once traffic and reporting needs grow.

The state row includes an internal version number. Checkout, stock changes, and
payment confirmation use a PostgreSQL transaction with a row lock. Other writes
use optimistic version checks, so concurrent requests are rejected instead of
silently overwriting newer data. Deployment only adds the `version` column with
a default value; it does not delete or rewrite existing application data.

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

### Encrypted offsite backup

Production also runs a daily Vercel Cron backup through
`/api/internal/backup`. Use a dedicated **private** Vercel Blob store, separate
from Neon and from public product images, and configure:

```txt
CRON_SECRET
KASIRKITA_BACKUP_BLOB_STORE_ID
KASIRKITA_BACKUP_ENCRYPTION_KEY
KASIRKITA_BACKUP_RETENTION_DAYS=30
```

Generate the encryption key with `openssl rand -base64 32`. Store a recovery
copy in a password manager or operating-system keychain; losing this key makes
the encrypted backups unrecoverable. Each upload is read back, authenticated,
checksum-verified, and checked for the expected record count before the cron is
reported successful. Objects older than the retention period are removed.

`vercel.json` schedules the job at `18:15 UTC` (`01:15 WIB`). An unauthorized
request to the internal endpoint must return HTTP `401`.

## GitHub repository push

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
- Production refuses to create or verify sessions when `KASIRKITA_AUTH_SECRET` is missing, too short, or still a placeholder.
- Never commit Owner bootstrap values, database credentials, payment keys, or email-provider tokens.
