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

## Vercel setup

The app can run locally with a JSON file. For Vercel production, use Vercel KV/Redis so admin accounts, products, transactions, QRIS config, debts, and withdrawals persist across serverless functions.

1. Open Vercel project → Storage.
2. Create/connect a KV/Redis store.
3. Make sure these environment variables exist in Project Settings → Environment Variables:

```txt
KV_REST_API_URL
KV_REST_API_TOKEN
KASIRKITA_AUTH_SECRET
```

`KASIRKITA_AUTH_SECRET` should be a random string. Generate locally with:

```bash
openssl rand -base64 32
```

4. Redeploy the project.

The first request will seed the owner automatically if the KV database is empty.

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
- Vercel production should use KV/Redis through `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
- `/tmp` storage is not reliable for production because different serverless functions may not share the same files.
