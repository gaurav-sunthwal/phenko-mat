# Phenko Mat — Project Overview

> *"Phenko mat"* — Hindi for **"don't throw it away."**

Phenko Mat is a swipe-based app for giving away or selling things you no longer use to people nearby who need them. Think **Bumble, but for stuff**: instead of swiping on people, you swipe on items (a T-shirt, a chair, a lamp, school books) listed by people around you. Swipe right and you're connected with the owner. You chat, sort out the details, and pick the item up.

---

## 1. The problem

Most households have things that are still usable but no longer needed: clothes that don't fit, old gadgets, furniture, kids' toys, extra kitchenware. Today these get:

- thrown away, adding to waste,
- stored forever because selling takes effort, or
- listed on classifieds sites where browsing is slow and the chat is full of haggling and spam.

Meanwhile, someone a few streets away may need exactly that item.

## 2. The solution

A simple, fun, local-first way to match **people who have things** with **people who need things**:

1. **Givers** photograph an item and list it in under a minute, either free or for a small price.
2. **Takers** swipe through a feed of nearby items, one card at a time.
3. **Right swipe** means "I want this." It creates a connection with the giver.
4. **Left swipe** means "Not for me." The item is skipped.
5. Once connected, both sides **chat** to agree on the details and arrange pickup.

That's the whole product. Everything else supports this loop.

---

## 3. Core user flow

```
 Giver                                   Taker
 ─────                                   ─────
 Lists item (photos, title,              Opens Feed → sees nearby items
 categories, price/free, area)                 │
        │                                ◄─ swipe left  → skip
        │                                ─► swipe right → "I want this"
        ▼                                      │
 Gets a new connection  ◄──────────────────────┘
        │
        ▼
 Chat: "Is it still available?" → agree on time/place → pickup
        │
        ▼
 Giver marks item as "Given away" → it leaves everyone's feed
```

---

## 4. App structure: three main tabs

### Tab 1: Feed
The home screen. It shows a stack of swipeable cards for items **near the user**, ranked by:

- **Distance**: closer items come first; the user sets a search radius.
- **Taste**: categories the user has picked as interests, and categories they swipe right on often, are boosted over time.
- **Freshness**: newer listings get a small boost.

Each card shows the item photos (tap to flip through), title, distance, price or "Free", condition, and category badges. An info button opens the full description and the owner's details.

### Tab 2: Categories
A grid of categories. Tapping one opens a swipe deck containing only that category's items, for when the user wants something specific.

**Default categories:**

| Type | Categories |
|---|---|
| Tier | Premium, Normal, Daily Needs |
| Kind | Clothing, Electronics, Books, Furniture, Kitchen, Kids & Toys, Sports, Accessories, Home Decor |

- An item can belong to **several categories** (e.g., a jacket can be *Clothing* + *Premium*).
- **Users can create new categories** when listing an item or from the Categories tab, so the catalogue grows with the community.

### Tab 3: Profile
- Name, photo, short bio, and approximate location (area name, never an exact address)
- **Interests**: categories the user wants to see more of, which feed the ranking
- **My listings**: active items, with actions to edit, mark as given away, or delete
- **Liked items**: everything the user swiped right on
- Simple stats: items given, items received

### Also available from anywhere
- **List an item (+)**: photos, title, description, categories, condition, free/price, pickup area
- **Chats**: all connections, each chat pinned to the item it's about

---

## 5. Key screens and interactions

| Screen | What happens |
|---|---|
| Swipe card | Drag left or right (or use the ✕ / ♥ buttons or arrow keys). "WANT" / "PASS" stamps appear while dragging. |
| "It's a connection!" | Shown after a right swipe, with two choices: **Send a message** or **Keep swiping**. |
| Chat thread | Item preview at the top, then messages. Quick replies such as "Is it still available?" and "When can I pick it up?" |
| List item | Multi-photo upload, category chips with "+ New category", free/price toggle |
| Empty deck | "You've seen everything nearby." Suggests widening the radius or trying another category. |

---

## 6. Design language (inspired by Bumble)

- **Colour:** signature warm yellow (`#FFC629`) as the brand colour, near-black (`#1D1D1D`) text, white cards, and soft cream backgrounds.
- **Shapes:** large rounded corners, pill buttons, big full-bleed photo cards.
- **Type:** bold, friendly geometric sans-serif with large confident headings.
- **Motion:** cards tilt and fly off on swipe; springy button presses; a celebratory connection screen.
- **Layout:** mobile-first. On desktop the app sits in a centred phone-width column.
- **Tone:** warm and playful. "Someone nearby needs this."

---

## 7. Data model

Postgres on Neon with the PostGIS extension, managed by Drizzle ORM (`db/schema.ts`, migrations in `db/migrations/`).

| Table | Purpose |
|---|---|
| `users` | Profile, area name, lat/lng plus a generated PostGIS `location`, search radius. Linked to Firebase by `firebase_uid`. |
| `categories` | Built-in (tier/kind) and user-created (custom) categories. Names are unique regardless of case. |
| `user_interests` | Categories a user wants to see first. |
| `items` | Listings. `photos text[]` (1–6), `price_inr` (0 = free), status `active` / `given` / `removed`. |
| `item_categories` | Many-to-many link between items and categories. |
| `swipes` | One row per user per item (left/right). Keeps swiped items out of the feed and drives taste ranking. |
| `connections` | Created by a right swipe. One per (item, taker), with per-side read markers for unread counts. |
| `messages` | Chat messages. An auto-incrementing `bigint` id doubles as the polling cursor. |
| `reports` | Item and user reports for moderation. |
| `rate_limits` | Fixed-window counters shared by all server instances. |

**Scalability choices**
- The "items within X km" query runs on a partial GiST index over active items only, fetching nearest-first and capped at 400 candidates. Ranking then happens in SQL: taste − 0.25 × km − 0.3 × days old.
- IDs are `uuidv7` (time-ordered), which keeps B-tree indexes compact.
- The Neon HTTP driver needs no connection pool. Multi-step writes use atomic `db.batch`.
- Chat is pushed over WebSockets (see §9). Catching up after a reconnect asks only for messages newer than the last one received, using an index on `(connection_id, id)`.
- Messages carry a client-generated `client_id` with a unique `(sender_id, client_id)` index, so a retried send never creates a duplicate.

---

## 8. Privacy and safety

- Show only **approximate distance and area name**. Never show an exact address until the users choose to share it in chat.
- Report and block users; report listings.
- Meet-up safety tips in chat (meet in public places, check the item before paying).
- Owners can remove a listing or close a connection at any time.

---

## 9. Realtime chat (WebSockets)

```
browser ──HTTPS──► Next.js API ──► Postgres                 (every write; source of truth)
   ▲                    │
   │                    └──internal HTTP publish──► realtime gateway (Node + ws)
   └──────────────── WebSocket ◄───────────────────────┘
```

- **Writes always go through the API.** Sending a message is `POST /api/connections/:id/messages`: validated, rate limited, and stored in Postgres. Only after that does the API publish an event, and it does so after the response has gone out (`after()`), so a slow or down gateway never slows a request.
- **The gateway** (`realtime/server.ts`) holds the sockets and pushes these events: `message.new`, `connection.new` (someone wants your item), `connection.read` (read receipts), and `typing`.
- **Authentication.** The browser fetches a 60-second, single-use, HMAC-signed ticket from `POST /api/realtime/ticket`, where the session cookie is fully verified, and passes it in the socket URL. The gateway also checks the `Origin` header.
- **Protection.** A 4 KB frame limit, 20 frames per 10 seconds per socket (flooding closes the socket with code 1008), 10 sockets per user, pings every 30 seconds to drop dead connections, and disconnection of clients that can't keep up (more than 1 MB queued). Typing signals are only forwarded after the gateway confirms the sender is part of that chat.
- **Reliability.** The client reconnects with exponential backoff plus random jitter (capped at 30 s), and retries immediately when the browser comes back online or the tab is shown again. After every reconnect it fetches missed messages using the cursor. If the socket is down, it falls back to polling every 10 seconds. On deploy, the gateway closes sockets with code 1012 so clients reconnect straight away.
- **Optimistic UI.** A message appears instantly and is replaced by the confirmed one when the server responds. Failed sends stay on screen with a retry button, and retries reuse the same `client_id`.
- **Scaling out.** Fan-out goes through a `Broker` interface (`realtime/broker.ts`). Today `LocalBroker` covers a single gateway instance. For multiple instances, add a `RedisBroker` that publishes to a per-user channel (`u:{userId}`) and has each instance subscribe for the users connected to it. Nothing else changes. Single-use ticket tracking moves to Redis at the same time (`SET NX EX`).

## 10. Client state

- **Zustand** (`lib/client/stores/`) holds client state:
  - `chat`: messages per chat, messages waiting to send, typing indicators, read receipts
  - `realtime`: socket status and the signed-in user's id
  - `ui`: the match popup, the chosen feed scope, and items swiped this session
- **SWR** caches server data (profile, lists, feed) with revalidation. WebSocket events revalidate the relevant lists instead of waiting on polling.

## 11. Security

- **Authentication.** Firebase Auth handles email/password, Google, and Apple sign-in. The browser sends a fresh ID token to `POST /api/auth/session`. The server verifies it with Firebase Admin, checking signature, revocation, sign-in method, how recent the sign-in was, and (for email accounts) that the email is verified. It then sets an **httpOnly, Secure, SameSite=Lax** session cookie. The browser keeps no Firebase tokens.
- **Native apps (iOS/Android)** don't use the cookie. They send `Authorization: Bearer <Firebase ID token>` (auto-refreshed hourly by the Firebase SDK) and register once through `POST /api/auth/native`, with the same checks as a web sign-in. When an Authorization header is present, the cookie is ignored. That is why the CSRF Origin check can be skipped for these requests: browsers can't attach that header cross-site. Socket tickets minted for bearer requests carry a signed `nat` claim, so the gateway skips its Origin check for them. Sign-out (`DELETE /api/auth/session` with the bearer token) revokes refresh tokens.
- **Every API request** re-verifies the session cookie, including a revocation check (cached for 60 seconds per server). Signing out revokes all refresh tokens.
- **Authorization is enforced on the server.** Only owners can edit or remove items. Only the two people in a chat can read or send in it. Nobody can swipe on their own items. A missing resource and one you can't access both return a 404, so IDs can't be probed.
- **Input validation.** Every body and query is validated with zod (`lib/validation.ts`), which matches the database CHECK constraints. Control characters are stripped and JSON bodies are capped at 64 KB.
- **CSRF protection.** SameSite cookies, plus a required matching `Origin` header on every write.
- **Rate limiting** per user (or per IP for sign-in): for example, 30 messages a minute, 20 listings an hour, and 10 sign-in attempts a minute.
- **Uploads.** The server checks the real file type from its first bytes (JPEG, PNG, or WebP only) and caps size at 5 MB. Images are re-encoded on the device first, which also strips GPS data. Files are stored under `u/{userId}/` in Cloudflare R2. Photos are only uploaded when a listing is published or a profile is saved. Listings can only use photos the same user uploaded.
- **Photo cleanup.** A daily job (`/api/cron/photo-cleanup`, protected by `CRON_SECRET`) deletes photos nothing references after 24 hours (replaced avatars, photos dropped while editing, abandoned publishes), and trims listings to their cover photo 30 days after removal or 90 days after being given away. Deleting an account removes that user's photos immediately. Run it by hand with `pnpm photos:cleanup` (dry run) or `pnpm photos:cleanup --apply`. It refuses to delete more than half the bucket in one run.
- **Privacy.** Other users' coordinates are never returned; the API gives only the area name and a distance rounded to 0.1 km. Browser location is rounded to about 100 m before it is saved.
- **Realtime security.** Socket tickets are signed and single-use, the `Origin` header is checked, the gateway's publish endpoint requires a shared secret (compared in constant time), and flood limits apply per socket (see §9).
- **Security headers** are set in `next.config.ts`: HSTS, X-Frame-Options DENY, nosniff, and a restrictive Permissions-Policy.
- **Secrets** live only in `.env.local`, which git ignores. `.env.example` documents the required keys.

---

## 12. API

All endpoints are under `/api`, return JSON, and require a session unless noted.

| Method | Path | Purpose |
|---|---|---|
| POST / DELETE | `/auth/session` | Sign in by exchanging a Firebase ID token (no session needed) / sign out |
| POST | `/auth/native` | Native app sign-in: registers the bearer token's user (no cookie) |
| GET / PATCH / DELETE | `/me` | Profile, stats, location, radius, interests / update / delete account |
| GET | `/me/items`, `/me/likes` | My listings / items I swiped right on |
| GET | `/feed?category=&limit=` | Ranked nearby deck |
| GET / POST | `/categories` | List with nearby counts / create a custom category |
| POST | `/items` | Create a listing |
| GET / PATCH / DELETE | `/items/:id` | Detail / edit or mark as given / remove |
| POST | `/items/:id/report` | Report a listing |
| POST / DELETE | `/swipes` | Swipe (a right swipe returns the new connection) / reset passes |
| GET | `/connections`, `/connections/:id` | Chats with last message and unread count |
| GET / POST | `/connections/:id/messages?after=` | Poll for / send messages |
| POST | `/connections/:id/read` | Mark a chat as read |
| POST | `/uploads` | Upload an image (multipart) |
| POST | `/realtime/ticket` | Short-lived ticket for opening the chat WebSocket |

---

## 13. Code layout

```
app/                 pages (landing, login, (app)/(tabs)/feed|categories|profile|chats, chat/[id], new) + api/
components/          SwipeDeck, SwipeCard, MatchModal, AppShell, LocationSetup, …
db/                  schema.ts, migrations/, index.ts (server-only client)
lib/server/          env, auth, api wrapper, errors, rate limit, firebase-admin, services/*
lib/client/          fetch helpers, SWR hooks, WebSocket client, zustand stores, Firebase client
lib/realtime/        wire protocol + ticket signing (shared by API, gateway, browser)
realtime/            WebSocket gateway service (server.ts, broker.ts)
lib/validation.ts    zod schemas shared by client and server
lib/dto.ts           API response types
scripts/seed.ts      categories + optional demo data
proxy.ts             sends signed-out visitors to /login
```

## 14. Running it

```bash
pnpm install
cp .env.example .env.local        # then fill it in
pnpm db:migrate                   # apply migrations to Neon
pnpm db:seed                      # built-in categories
pnpm db:seed --demo               # optional: demo neighbours + 31 listings (default: central Pune)
pnpm db:seed --demo-logins        # optional: make demo neighbours real accounts → .demo-logins.local
pnpm db:seed --clear-demo         # remove demo data and demo Firebase accounts
pnpm dev                          # Next.js on :3000 + realtime gateway on :3001
```

Firebase console setup:
1. **Authentication → Sign-in method:** enable Email/Password, Google, and Apple.
2. **Authentication → Settings → Authorized domains:** add your production domain.
3. **Server credentials.** Pick one:
   - **Keyless (default).** Leave `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` empty. Locally, run `gcloud auth application-default login` and then `gcloud auth application-default set-quota-project phenko-mat`. On Cloud Run or Firebase App Hosting, the runtime service account is used automatically.
   - **Key file.** Only works where your org policy allows keys: *Project settings → Service accounts → Generate new private key*, then copy `client_email` and `private_key`.

Cloudflare R2 setup (photo uploads):
1. **R2 → Create bucket** (e.g. `phenko-mat-photos`) and put its name in `R2_BUCKET`.
2. **Bucket → Settings → Public access:** enable the r2.dev URL for development, or connect a custom domain for production (r2.dev is rate-limited and not meant for production traffic). Put it in `R2_PUBLIC_URL`, no trailing slash.
3. **R2 → Manage API tokens → Create token:** "Object Read & Write", scoped to that bucket only. Copy the Access Key ID and Secret into `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. Your account ID (shown on the R2 overview page) goes in `R2_ACCOUNT_ID`.
4. **Daily cleanup:** set `CRON_SECRET`, then have a scheduler call `/api/cron/photo-cleanup` once a day with `Authorization: Bearer $CRON_SECRET` (Vercel Cron, Cloud Scheduler, or a GitHub Actions schedule).

---

## 15. Roadmap

**Done**
- Swipe feed, category decks, connections, listings, custom categories, profile and interests
- WebSocket chat: typing indicators, read receipts, optimistic sends, reconnect + resync
- Neon Postgres + PostGIS, Drizzle, Firebase Auth, secured REST API, image uploads

**Next**
- Redis: `RedisBroker` for multiple gateway instances, and move rate limits and ticket tracking from Postgres/memory to Redis
- Push notifications (FCM) for users who are offline
- Deploy: Next.js on Firebase App Hosting or Cloud Run; gateway on Cloud Run (WebSockets supported; `--timeout=3600`, min instances ≥ 1)
- Moderation dashboard for reports; blocking users
- Ratings after a handover
- PWA install
- Native apps: built in `../phenko-mat` (Expo). Next up: push notifications (FCM/APNs) for chat

---

## 16. Open questions

1. **Payments:** should paid items be settled in-app (UPI), or only arranged in chat?
2. **Limits:** should a taker be able to request many items at once, and can a giver have several takers queued for one item?
3. **Premium tier:** is "Premium" only a category (high-value items), or also a paid user plan (e.g., see who liked your item, boost a listing)?
4. **Launch area:** start with one city or neighbourhood to seed enough nearby listings?
