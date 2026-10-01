# Phenko Mat — iOS & Android

The native app for Phenko Mat ("don't throw it away"): swipe on things neighbours are giving away,
connect, chat, pick up. Same product, UI and backend as [`../phenko-mat-web`](../phenko-mat-web/project.md).

## Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Expo SDK 57, React Native 0.86 (New Architecture), React 19 + React Compiler | Recommended RN framework; CNG, EAS builds and OTA updates |
| Navigation | expo-router (file-based), native stack + native form sheets | Deep links and typed routes for free |
| Server state | TanStack Query | Caching, retries, pauses offline (NetInfo), refetches on foreground (AppState) |
| Client state | Zustand | Same stores as the web (chat, realtime, ui) |
| Gestures & motion | Gesture Handler + Reanimated 4 | Swipe deck runs on the UI thread at 60–120 fps |
| Lists | FlashList v2 | Recycling lists for chats, messages, categories, listings |
| Images | expo-image | Memory and disk cache, prefetching of the next cards |
| Keyboard | react-native-keyboard-controller | Chat composer and forms stay above the keyboard on both platforms |
| Auth | Firebase JS SDK + native Google Sign-In and Sign in with Apple | Same Firebase project as the web |
| Validation | zod, with schemas shared with the web | One set of rules for both clients |
| Font and icons | Plus Jakarta Sans; icons ported path-for-path from the web | Identical look |

## Project layout

```
src/
  app/            Routes only: thin files that render a feature screen
    (app)/        Signed-in area: tabs, chat/[id], new, match, and sheets (location, new-category, edit-profile, delete-account)
    login.tsx
  features/       One folder per domain: api.ts (queries/mutations) + components/screens
    auth/ feed/ categories/ connections/ chat/ listing/ location/ profile/ match/ shell/
  components/ui/  Design-system primitives (Text, Button, TextField, Chip, Avatar, Photo, icons…)
  lib/            api client, uploads, React Query client + key factory, realtime socket, firebase
  stores/         Cross-feature client state
  theme/          Design tokens that mirror the web's Tailwind theme
  shared/         GENERATED from the web repo (DTOs, zod schemas, formatting, realtime protocol)
  config/env.ts   Validated EXPO_PUBLIC_* config
```

Rules that keep it scalable:
- Screens never call `fetch`. They use feature hooks (`useMe`, `useFeed`…), which use `lib/api/client`.
- All query keys come from `lib/query/keys.ts`, so invalidation stays consistent.
- Colours, radii, fonts and shadows come from `theme/`. No hex values in screens.
- Reanimated shared values use `.get()` / `.set()` (required with the React Compiler).
- `src/shared/*` is copied from the web. Change it there, then run `pnpm sync:shared`.

## Running it

```bash
pnpm install
cp .env.example .env.local        # API URL + Firebase web config (same project as the web app)
pnpm ios                          # or: pnpm android. Builds a development client (native modules)
```

- The backend is `phenko-mat-web`. Run `pnpm dev` there to start the API on :3000 and the realtime gateway on :3001.
- On a physical device, set `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_REALTIME_URL` to your computer's LAN IP.
- The app needs a development build (`expo run:*` or `eas build --profile development`). Expo Go does not include Google Sign-In or the keyboard controller.
- **Google sign-in:** create iOS and Android OAuth clients in the Firebase project. Set `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`, then rebuild. The button stays hidden until these are set.
- **Apple sign-in:** iOS only. Enable "Sign in with Apple" for the bundle id and the Apple provider in Firebase.

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm doctor`.

## How it talks to the backend

Browsers use an httpOnly session cookie. The app instead sends `Authorization: Bearer <Firebase ID token>`,
which the SDK refreshes every hour. After signing in, the app calls `POST /api/auth/native`. The server
applies the same checks as the web (allowed provider, verified email) and creates the user row. On a
401, the client retries once with a fresh token, then signs out.

Chat uses the same WebSocket gateway and protocol as the web: a single-use ticket, then reconnects
with backoff and jitter. On top of that, the app closes the socket when it goes to the background,
reconnects when it returns to the foreground or the network comes back, and fetches missed messages
with the message cursor.
