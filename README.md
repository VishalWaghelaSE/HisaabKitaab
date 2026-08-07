# HisaabKitaab

A bill, expense, and income tracker web app that works on mobile and desktop browsers alike, installable as a Progressive Web App with browser push reminders for upcoming/overdue bills.

## Stack

- **Client**: React + Vite + TypeScript + Tailwind CSS, React Router, Recharts, installable PWA (service worker via `vite-plugin-pwa`)
- **Server**: Node.js + Express + TypeScript, Prisma ORM with PostgreSQL, JWT auth, Web Push (VAPID) + `node-cron` for scheduled reminders

## Features

- Sign up / sign in (JWT auth), data synced to your account
- **Bills**: one-time or recurring (weekly/monthly/yearly), mark as paid (auto-logs an expense and rolls recurring bills to the next due date), reminders N days before due
- **Expenses**: category-tagged spending log
- **Income / Credits**: money received, by source
- **Dashboard**: monthly totals, net, category breakdown chart, 6-month trend, upcoming (next 7 days) and overdue bill lists
- **Reminders**: browser push notifications for bills due soon or overdue, sent daily by a server cron job, plus in-app banners on the dashboard
- **Bank & credit card connections**: link an account (via [Plaid](https://plaid.com)) from Settings to pull in transactions automatically — spending becomes an expense, deposits become income, synced every few hours plus on-demand. Optional; the app is fully manual-entry without it.
- Responsive layout: top nav on desktop, bottom tab bar on mobile; installable to your home screen

## Project layout

```
server/   Express API + Prisma schema (PostgreSQL)
client/   React app (Vite)
```

## Getting started

### 0. Database

The app needs a Postgres database. For local development, the easiest way is Docker:

```bash
docker compose up -d db   # starts Postgres on localhost:5432 (see docker-compose.yml)
```

Or point `DATABASE_URL` at any Postgres instance (a free one from [Neon](https://neon.tech), [Supabase](https://supabase.com), or Railway's Postgres plugin all work).

### 1. Server

```bash
cd server
cp .env.example .env     # DATABASE_URL already matches the docker-compose Postgres
npm install
npx prisma migrate dev   # applies the schema
npm run dev               # http://localhost:4000
```

To enable push notifications, generate a VAPID key pair and put them in `server/.env`:

```bash
npx web-push generate-vapid-keys
```

Copy the printed public/private keys into `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` in `server/.env` (and set `VAPID_SUBJECT` to a `mailto:` address). Without these, the app still works fully — you just won't get push reminders (in-app dashboard reminders still show).

To enable bank/credit card connections, sign up free at [dashboard.plaid.com/signup](https://dashboard.plaid.com/signup) and put your Sandbox `client_id`/`secret` into `PLAID_CLIENT_ID` / `PLAID_SECRET` in `server/.env`. In Sandbox you can connect fake institutions (e.g. "Platypus Bank", username `user_good`, password `pass_good`) to try the full flow without a real bank. Moving to Production (real banks) requires separate approval from Plaid and has per-connection costs — see their pricing. Without these keys, the Settings page just reports connections as unavailable and the rest of the app is unaffected.

### 2. Client

```bash
cd client
npm install
npm run dev   # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:4000`, so run both the server and client together during development.

### 3. Deploying (Railway)

The root `Dockerfile` builds the client and server together into a single image: the server serves the built client as static files and answers `/api/*` itself, so there's only one service to deploy and no CORS/proxy setup needed in production.

1. Push this repo to GitHub (already done if you're reading this from the repo) and sign up at [railway.app](https://railway.app).
2. **New Project → Deploy from GitHub repo**, pick this repo. Railway detects `railway.json` and builds the root `Dockerfile` automatically.
3. **Add a database**: in the same project, click **New → Database → PostgreSQL**. Railway provisions it and exposes a `DATABASE_URL` — reference it in your app service's variables as `${{Postgres.DATABASE_URL}}` (Railway's variable-reference syntax) so it's wired up automatically.
4. On the app service, set these **Variables**:
   - `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` (from step 3)
   - `JWT_SECRET` → a long random string
   - `CLIENT_ORIGIN` → your Railway app URL (e.g. `https://your-app.up.railway.app`) — same-origin since client + API are served together, but the server still checks it for CORS safety
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` → from `npx web-push generate-vapid-keys` (optional, enables push reminders)
   - `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV` / `PLAID_PRODUCTS` / `PLAID_COUNTRY_CODES` → optional, enables bank connections
5. Deploy. On boot, `npm start` runs `prisma migrate deploy` against the Postgres instance before starting the server, so schema changes apply automatically on every deploy.
6. Railway assigns a public URL under **Settings → Networking → Generate Domain**; that's the whole app (client + API).

Any other Docker-friendly host (Fly.io, Render, a plain VPS) works the same way — build the root `Dockerfile`, point `DATABASE_URL` at a Postgres instance, and set the same environment variables.

## Notes

- Currency defaults to CAD; change `currency` on the user record (via the API) to display a different currency.
- The reminder cron job runs daily at 8 AM server time and pushes notifications to every subscribed device for bills due within their configured reminder window (default 3 days) or already overdue.
