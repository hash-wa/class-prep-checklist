# Class Prep Checklist

A small personal web app for tracking semester prep tasks per course. Maintain a
reusable master template of tasks (each due some number of weeks/days before or
after the semester start), and spin up a fresh checklist for every course you add,
each semester.

- Multiple courses per semester, full semester history
- Master template snapshotted into each course at creation time, with a banner if
  the template has since changed
- Manual drag-to-reorder, or sort by computed due date
- Done / N/A (irrelevant) checkboxes per task
- Single shared password, no per-user accounts

## Local setup

1. Install dependencies:

   ```
   npm install
   ```

2. Create a free Postgres database. The quickest option is [Neon](https://neon.tech)
   (no credit card required) — create a project and copy its connection string.
   A [Vercel Postgres](https://vercel.com/storage/postgres) database (also
   Neon-backed) works the same way.

3. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — the connection string from step 2
   - `APP_PASSWORD` — the password you'll use to log into the app
   - `SESSION_SECRET` — a random string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

4. Push the schema to your database:

   ```
   npm run db:push
   ```

5. Start the dev server:

   ```
   npm run dev
   ```

   Visit http://localhost:3000, log in with `APP_PASSWORD`, and go to **Master
   Template** first to set up your reusable checklist items before adding courses.

## Deploying to Vercel (free tier)

1. Push this repository to GitHub.
2. In Vercel, "Add New Project" and import the repo.
3. Attach a Postgres database to the project (Vercel's Storage tab — this sets
   `DATABASE_URL`/`POSTGRES_URL` automatically), or paste your own Neon connection
   string as an env var named `DATABASE_URL`.
4. Add the `APP_PASSWORD` and `SESSION_SECRET` environment variables in the
   project's Settings → Environment Variables.
5. Deploy. After the first deploy, run `npm run db:push` locally (pointed at the
   production `DATABASE_URL`) once to create the tables — or run it before your
   first deploy against the same database.

## Notes

- `db:push` (Drizzle Kit) syncs the schema directly — there's no separate
  migration history, which is fine for a single-user app like this.
- All data pages are rendered dynamically (no caching) so changes always show up
  immediately; there's no need to manually refresh.
