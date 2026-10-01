import { z } from "zod";

/*
 * Runtime config. Expo inlines `process.env.EXPO_PUBLIC_*` at build time, so each key must be
 * referenced literally (no dynamic `process.env[name]`).
 */

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

const schema = z.object({
  apiUrl: z.url().transform((u) => u.replace(/\/+$/, "")),
  realtimeUrl: optional(z.url()),
  firebase: z.object({
    apiKey: optional(z.string()),
    authDomain: optional(z.string()),
    projectId: optional(z.string()),
    appId: optional(z.string()),
  }),
  google: z.object({
    webClientId: optional(z.string()),
    iosClientId: optional(z.string()),
  }),
  /** Microsoft Clarity project (session analytics); unset = Clarity off. */
  clarityProjectId: optional(z.string()),
});

const parsed = schema.safeParse({
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
  realtimeUrl: process.env.EXPO_PUBLIC_REALTIME_URL,
  firebase: {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  },
  google: {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  },
  clarityProjectId: process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID,
});

if (!parsed.success) {
  throw new Error(`Invalid EXPO_PUBLIC_* config: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
}

export const env = parsed.data;

export const firebaseConfigured = Boolean(
  env.firebase.apiKey && env.firebase.authDomain && env.firebase.projectId && env.firebase.appId,
);
export const googleConfigured = Boolean(env.google.webClientId);
