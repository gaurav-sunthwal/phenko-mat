# phenko-mat

Swipe to give and get things nearby. One repo, three projects that share one Neon database, Firebase project and R2 bucket:

| Folder | What | Runs on |
|---|---|---|
| [`phenko-mat-web/`](phenko-mat-web) | Next.js website **and** the API the app uses. Source of truth for the DB schema, DTOs and validation. Also contains the chat WebSocket gateway in [`realtime/`](phenko-mat-web/realtime). | Vercel (Root Directory `phenko-mat-web`); gateway on a Node host (`pnpm start:realtime`) |
| [`phenko-mat/`](phenko-mat) | Expo / React Native app (iOS, Android). | EAS builds from this folder |
| [`phenko-mat-admin/`](phenko-mat-admin) | Moderation and management panel. | Its own Vercel project (Root Directory `phenko-mat-admin`) |

The projects are independent packages (each has its own `package.json` and lockfile) — run `pnpm install` inside each.

## Shared code

`phenko-mat-web` owns the shared code; the others copy it in:

```bash
cd phenko-mat && pnpm run sync:shared        # dto, validation, format, realtime protocol → src/shared/
cd phenko-mat-admin && pnpm run sync:schema  # DB schema
```

Never edit the copies by hand; change `phenko-mat-web` and re-sync.

## Secrets

Never commit `.env.local` files or service-account keys. Each project has an `.env.example` listing what it needs.
