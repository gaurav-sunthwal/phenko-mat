import "server-only";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const schema = z
  .object({
    DATABASE_URL: z.url().startsWith("postgres"),
    /** Comma-separated Google account emails allowed into the admin panel. Empty = nobody gets in. */
    ADMIN_EMAILS: z
      .string()
      .default("")
      .transform((v) =>
        v
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),
      ),
    FIREBASE_PROJECT_ID: z.string().min(1),
    FIREBASE_CLIENT_EMAIL: z.preprocess(emptyToUndefined, z.email().optional()),
    FIREBASE_PRIVATE_KEY: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .transform((k) => k.replace(/\\n/g, "\n"))
        .optional(),
    ),
    R2_ACCOUNT_ID: z.string().min(1),
    R2_ACCESS_KEY_ID: z.string().min(1),
    R2_SECRET_ACCESS_KEY: z.string().min(1),
    R2_BUCKET: z.string().min(1),
    /** Base URL of the web app/API, for the Health page's live checks (e.g. https://phenkomat.app). */
    WEB_APP_URL: z.url().default("http://localhost:3000"),
  })
  .refine((e) => Boolean(e.FIREBASE_CLIENT_EMAIL) === Boolean(e.FIREBASE_PRIVATE_KEY), {
    message: "Set both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or neither (keyless mode).",
    path: ["FIREBASE_PRIVATE_KEY"],
  });

let parsed: z.infer<typeof schema> | undefined;

/**
 * The admin allow-list, read fresh on every call (not cached with the rest), so editing ADMIN_EMAILS
 * takes effect immediately — including revoking someone.
 */
export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Validated lazily so `next build` works without secrets; a request that needs them fails loudly. */
export function env() {
  if (parsed) return parsed;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const keys = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing admin environment variables: ${keys}`);
  }
  parsed = result.data;
  return parsed;
}
