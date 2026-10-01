import { cookies } from "next/headers";
import { publicRoute, readJson } from "@/lib/server/api";
import {
  SESSION_COOKIE,
  bearerToken,
  createSession,
  destroySession,
  isBearerRequest,
  revokeBearer,
  sessionCookieOptions,
} from "@/lib/server/auth";
import { sessionSchema } from "@/lib/validation";

/** Exchange a fresh Firebase ID token for an httpOnly session cookie. */
export const POST = publicRoute(
  async ({ req }) => {
    const { idToken } = await readJson(req, sessionSchema);
    const { cookie, user } = await createSession(idToken);
    (await cookies()).set(SESSION_COOKIE, cookie, sessionCookieOptions());
    return { user: { id: user.id } };
  },
  { rateLimit: { name: "auth:session", limit: 10, windowSec: 60, store: "shared" } },
);

/** Sign out: revoke Firebase refresh tokens and clear the cookie (or the native app's bearer token). */
export const DELETE = publicRoute(async ({ req }) => {
  if (isBearerRequest(req)) {
    await revokeBearer(bearerToken(req));
    return { ok: true };
  }
  const store = await cookies();
  await destroySession(store.get(SESSION_COOKIE)?.value);
  store.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return { ok: true };
});
