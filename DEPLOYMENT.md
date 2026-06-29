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

## GitHub public repository push

This environment cannot create a GitHub repository without an authenticated GitHub account/token. Run these commands locally after unzipping the project:

```bash
cd warung-digital-fullstack
git init
git add .
git commit -m "Initial KasirKita deployment-ready build"

# Option A: with GitHub CLI, public repo
gh repo create kasirkita-fullstack --public --source=. --remote=origin --push

# Option B: after creating a public empty repo on GitHub manually
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kasirkita-fullstack.git
git push -u origin main
```

## Notes

- Prisma/Drizzle were removed for a deployment-friendly local JSON backend.
- Data is stored in `.data/kasirkita-db.json` at runtime and is ignored by git.
- For production use, replace the JSON store with a hosted database before handling real merchant data.
