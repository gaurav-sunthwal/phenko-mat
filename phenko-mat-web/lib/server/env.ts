import "server-only";
import { z } from "zod";

/*
 * Env is validated lazily, per concern, so the app can build (and DB-only scripts can run)
 * without every secret present — but a request that needs a secret fails loudly if it's missing.
 */

const dbSchema = z.object({
  DATABASE_URL: z.url().startsWith("postgres"),
});

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

/*
 * Two credential modes:
 * - Service-account key: FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 * - Keyless (both empty): Application Default Credentials — `gcloud auth application-default login`
 *   locally, or the attached service account on Cloud Run / Firebase App Hosting.
 */
const firebaseSchema = z
  .object({
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_CLIENT_EMAIL: z.preprocess(emptyToUndefined, z.email().optional()),
    // Stored with literal "\n" in most env UIs.
    FIREBASE_PRIVATE_KEY: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .transform((k) => k.replace(/\\n/g, "\n"))
        .optional(),
    ),
    /** Legacy: only needed while old Firebase Storage photo URLs are still in the database. */
    FIREBASE_STORAGE_BUCKET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  })
  .refine((e) => Boolean(e.FIREBASE_CLIENT_EMAIL) === Boolean(e.FIREBASE_PRIVATE_KEY), {
    message: "Set both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or neither (keyless mode).",
    path: ["FIREBASE_PRIVATE_KEY"],
  });

/** Cloudflare R2 (S3-compatible). Keys come from an R2 API token scoped to the one bucket. */
const storageSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  /** Public base URL for the bucket — the r2.dev URL or a custom domain, no trailing slash. */
  R2_PUBLIC_URL: z.url().transform((u) => u.replace(/\/+$/, "")),
});

const cronSchema = z.object({
  /** Bearer token that scheduled jobs (e.g. the daily photo cleanup) must send. */
  CRON_SECRET: z.string().min(32),
});

const realtimeSchema = z.object({
  /** Shared with the realtime gateway: signs WebSocket tickets and authenticates publishes. */
  REALTIME_SECRET: z.string().min(32),
  /** Where the API reaches the gateway (private network in production). */
  REALTIME_INTERNAL_URL: z.url().default("http://localhost:3001"),
  /** Where browsers reach the gateway. */
  NEXT_PUBLIC_REALTIME_URL: z.url().default("ws://localhost:3001/ws"),
});

const placesSchema = z.object({
  /** Server-side Google Maps Platform key with "Places API (New)" enabled. Never shipped to clients. */
  GOOGLE_MAPS_API_KEY: z.string().min(1),
});

const appSchema = z.object({
  /** Canonical origin, e.g. https://phenkomat.app. Used for CSRF origin checks. */
  APP_ORIGIN: z.url().optional(),
});

function memo<T>(fn: () => T): () => T {
  let value: T | undefined;
  return () => (value ??= fn());
}

function parse<S extends z.ZodType>(schema: S, name: string): z.infer<S> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const keys = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing ${name} environment variables: ${keys}`);
  }
  return result.data;
}

export const dbEnv = memo(() => parse(dbSchema, "database"));
export const firebaseEnv = memo(() => parse(firebaseSchema, "Firebase Admin"));
export const cronEnv = memo(() => parse(cronSchema, "cron"));
export const storageEnv = memo(() => parse(storageSchema, "R2 storage"));
export const appEnv = memo(() => parse(appSchema, "app"));
export const realtimeEnv = memo(() => parse(realtimeSchema, "realtime"));
/** Null when unset: place search is optional (the apps fall back to typing the area by hand). */
export const placesEnv = memo(() => {
  const r = placesSchema.safeParse(process.env);
  return r.success ? r.data : null;
});
