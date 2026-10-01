import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { adminEmails } from "./env";
import { adminAuth } from "./firebase-admin";

export const ADMIN_COOKIE = "__admin_session";
/** Short on purpose: admins sign in again every 8 hours. */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Only mint a session from a sign-in that just happened. */
const MAX_AUTH_AGE_SEC = 5 * 60;

export interface Admin {
  email: string;
  uid: string;
}

const isAllowed = (email: string | undefined) => Boolean(email && adminEmails().includes(email.toLowerCase()));

export function cookieOptions(maxAgeMs = SESSION_TTL_MS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

/** Exchanges a fresh Firebase ID token for an admin session cookie — only for allow-listed, verified emails. */
export async function createAdminSession(idToken: string) {
  const decoded = await adminAuth()
    .verifyIdToken(idToken, true)
    .catch(() => null);
  if (!decoded) return { ok: false as const, error: "Sign-in expired. Try again." };
  if (!decoded.email_verified || !isAllowed(decoded.email)) {
    // Naming the account helps the owner set up ADMIN_EMAILS; it's their own email, shown only to them.
    return {
      ok: false as const,
      error: adminEmails().length
        ? `${decoded.email ?? "This account"} isn't an admin. Add it to ADMIN_EMAILS to let it in.`
        : `No admins are set up yet. Add ${decoded.email ?? "your email"} to ADMIN_EMAILS in .env.local and restart.`,
    };
  }
  if (Date.now() / 1000 - decoded.auth_time > MAX_AUTH_AGE_SEC) {
    return { ok: false as const, error: "Please sign in again." };
  }
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_TTL_MS });
  (await cookies()).set(ADMIN_COOKIE, cookie, cookieOptions());
  return { ok: true as const };
}

/*
 * Verifying a session cookie with the revocation check is a network call to Firebase (~0.4 s, seconds
 * when cold). A verified cookie is remembered for a few minutes per server instance; the allow-list is
 * still checked on every request, so removing someone from ADMIN_EMAILS locks them out immediately,
 * and signing out (or a revoked session) takes effect within VERIFIED_TTL_MS.
 */
const VERIFIED_TTL_MS = 5 * 60 * 1000;
const verified = new Map<string, { admin: Admin; expires: number }>();
const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

async function verify(token: string): Promise<Admin | null> {
  const key = hashToken(token);
  const hit = verified.get(key);
  if (hit && hit.expires > Date.now()) return hit.admin;
  const decoded = await adminAuth()
    .verifySessionCookie(token, true)
    .catch(() => null);
  if (!decoded?.email) {
    verified.delete(key);
    return null;
  }
  const admin = { email: decoded.email, uid: decoded.uid };
  if (verified.size > 100) verified.clear();
  verified.set(key, { admin, expires: Date.now() + VERIFIED_TTL_MS });
  return admin;
}

/** The signed-in admin, or null. Deduplicated per request (layout, page and actions share one check). */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const admin = await verify(token);
  return admin && isAllowed(admin.email) ? admin : null;
});

/** For pages and server actions: the admin, or a redirect to the sign-in page. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export async function endAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  store.set(ADMIN_COOKIE, "", cookieOptions(0));
  if (!token) return;
  verified.delete(hashToken(token));
  const decoded = await adminAuth()
    .verifySessionCookie(token)
    .catch(() => null);
  if (decoded) await adminAuth().revokeRefreshTokens(decoded.uid).catch(() => undefined);
}
