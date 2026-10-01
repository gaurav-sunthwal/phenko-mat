# Phenko Mat Admin

Moderation and management panel for Phenko Mat. A separate Next.js app that works on the **same**
Neon database, Firebase project and R2 bucket as `../phenko-mat-web`.

## Run it

```bash
cp .env.example .env.local   # fill in (same values as the web app) + ADMIN_EMAILS
pnpm install
pnpm dev                     # http://localhost:3002
```

Sign in with Google. Only verified emails listed in `ADMIN_EMAILS` get in; removing an email locks
that person out on their next request.

## What it does

| Page | |
| --- | --- |
| **Dashboard** | Users, listings, chats, messages, suspended accounts, open reports; 14-day sign-ups/listings; most reported listings |
| **Reports** | Listings and people by number of reports (open or resolved). Remove a listing, suspend an account, or dismiss reports |
| **Listings** | Search/filter all listings; detail page with photos, stats, every report, and Remove |
| **Users** | Search/filter (reported, suspended); detail page with stats, listings, reports about them; Suspend / Lift suspension / Delete account |
| **Categories** | Usage counts; rename, delete or merge user-created categories (built-ins are managed by the web app's seed) |
| **Audit log** | Every action taken here: who, what, when |

What the actions do:

- **Remove listing** — hidden from every feed, photos deleted from R2, open reports marked *actioned*. Chats about it stay.
- **Suspend** — the web/mobile API refuses all requests from the account (`ACCOUNT_SUSPENDED`), its listings disappear,
  and its Firebase login is disabled and signed out. Open reports about them are marked *actioned*.
- **Delete account** — same as the user deleting it themselves: profile, listings, chats, photos and Firebase login.
- **Dismiss** — marks open reports *dismissed* without changing anything else.

## How it's built

- Next.js App Router, server components for pages, **server actions** for every change (`app/actions.ts`).
  Each action re-checks the admin session itself, so it's safe even if called directly.
- `lib/auth.ts` — Firebase session cookie (`__admin_session`, 8 h, `SameSite=Strict`) + allow-list check on every request.
- `lib/queries.ts` — read queries (Drizzle + SQL). `db/schema.ts` is **generated**: run `pnpm sync:schema` after the
  web app changes its schema. Migrations are only ever run from `phenko-mat-web`.
- `lib/r2.ts` — photo deletion; `lib/audit.ts` — the audit log.

Deploy it on its own (private) domain, separate from the public app.
