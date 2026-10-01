import { cookies } from "next/headers";
import { authedRoute, readJson } from "@/lib/server/api";
import { SESSION_COOKIE, destroySession, sessionCookieOptions } from "@/lib/server/auth";
import { adminAuth } from "@/lib/server/firebase-admin";
import { deleteMe, getMe, updateMe } from "@/lib/server/services/users";
import { profileUpdateSchema } from "@/lib/validation";

export const GET = authedRoute(({ user }) => getMe(user.id));

export const PATCH = authedRoute(
  async ({ req, user }) => updateMe(user.id, await readJson(req, profileUpdateSchema)),
  { rateLimit: { name: "me:update", limit: 30, windowSec: 60 } },
);

/** Permanently deletes the account and everything it owns. */
export const DELETE = authedRoute(
  async ({ user }) => {
    const store = await cookies();
    await deleteMe(user.id);
    await destroySession(store.get(SESSION_COOKIE)?.value);
    await adminAuth()
      .deleteUser(user.firebaseUid)
      .catch(() => undefined);
    store.set(SESSION_COOKIE, "", sessionCookieOptions(0));
    return { ok: true };
  },
  { rateLimit: { name: "me:delete", limit: 3, windowSec: 3600, store: "shared" } },
);
