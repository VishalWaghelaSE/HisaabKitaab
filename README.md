# HisaabKitaab

A bill, expense, and income tracker web app that works on mobile and desktop browsers alike, installable as a Progressive Web App with browser push reminders for upcoming/overdue bills.

## Stack

- **Client**: React + Vite + TypeScript + Tailwind CSS, React Router, Recharts, installable PWA (service worker via `vite-plugin-pwa`)
- **Server**: Node.js + Express + TypeScript, Prisma ORM with SQLite, JWT auth, Web Push (VAPID) + `node-cron` for scheduled reminders

## Features

- Sign up / sign in (JWT auth), data synced to your account
- **Bills**: one-time or recurring (weekly/monthly/yearly), mark as paid (auto-logs an expense and rolls recurring bills to the next due date), reminders N days before due
- **Expenses**: category-tagged spending log
- **Income / Credits**: money received, by source
- **Dashboard**: monthly totals, net, category breakdown chart, 6-month trend, upcoming (next 7 days) and overdue bill lists
- **Reminders**: browser push notifications for bills due soon or overdue, sent daily by a server cron job, plus in-app banners on the dashboard
- Responsive layout: top nav on desktop, bottom tab bar on mobile; installable to your home screen

## Project layout

```
server/   Express API + Prisma schema (SQLite)
client/   React app (Vite)
```

## Getting started

### 1. Server

```bash
cd server
cp .env.example .env
npm install
npx prisma migrate dev   # creates dev.db and applies the schema
npm run dev              # http://localhost:4000
```

To enable push notifications, generate a VAPID key pair and put them in `server/.env`:

```bash
npx web-push generate-vapid-keys
```

Copy the printed public/private keys into `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` in `server/.env` (and set `VAPID_SUBJECT` to a `mailto:` address). Without these, the app still works fully — you just won't get push reminders (in-app dashboard reminders still show).

### 2. Client

```bash
cd client
npm install
npm run dev   # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:4000`, so run both the server and client together during development.

### 3. Production build

```bash
cd server && npm run build && npm start
cd client && npm run build   # outputs static files to client/dist, deploy behind any static host / reverse proxy to the API
```

In production, set `CLIENT_ORIGIN` on the server to your deployed client URL, and point the client's requests at the deployed API (e.g. via a reverse proxy so `/api` reaches the server, matching the dev setup).

## Notes

- Currency defaults to INR; change `currency` on the user record (via the API) to display a different currency.
- The reminder cron job runs daily at 8 AM server time and pushes notifications to every subscribed device for bills due within their configured reminder window (default 3 days) or already overdue.
