# Quick Start: Database Setup

NexusDocs uses Prisma with a MySQL schema provider, but connects at runtime using the MariaDB adapter. A MariaDB instance is recommended.

## 1. Add `DATABASE_URL` to `.env.local`

```env
DATABASE_URL="mariadb://username:password@localhost:3306/nexusdocs"
```

Notes:
- `mysql://...` also works (the app normalizes it to `mariadb://...` at runtime).
- If you use special characters in your password, URL-encode them.
- On Windows, a system-level `DATABASE_URL` environment variable can override `.env.local`. If you change it, restart the dev server.

## 2. Create Database Tables

```bash
npx prisma db push
```

This creates the tables defined in `prisma/schema.prisma` (users/auth, projects, scans, proposals, audit log).

## 3. (Optional) Explore Your Database

```bash
npx prisma studio
```

Opens a visual database browser at `http://localhost:5555`

---

✅ Your database is now ready! Next: configure `.env.local` (see `README.md`) and run `npm run dev`.
