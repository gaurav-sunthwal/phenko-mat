import "server-only";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb, schema } from "@/db";
import { ApiError, forbidden, unauthorized } from "./errors";
import { adminAuth } from "./firebase-admin";

export const SESSION_COOKIE = "__session";
export const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000;

const ALLOWED_PROVIDERS = new Set(["password", "google.com", "apple.com"]);
/** Firebase recommends only minting session cookies from a sign-in that just happened. */
const MAX_AUTH_AGE_SEC = 5 * 60;

export interface SessionUser {
  id: string;
  firebaseUid: string;
  /** Suspended by an admin: every authenticated request is refused (see requireUser). */
  suspended?: boolean;
}

/* ---------- short-lived verification cache ---------- */

// Verifying a session cookie with revocation checks costs a network round trip to Firebase.
// Caching the result for a minute per instance keeps chat polling cheap; a revoked session
// stops working within CACHE_TTL_MS at most.
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 5_000;
const cache = new Map<string, { user: SessionUser; expires: number }>();

const hashToken = (token: string) => createHash("sha256").update(token).digest("base64url");

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.user;
}

function cacheSet(key: string, user: SessionUser) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { user, expires: Date.now() + CACHE_TTL_MS });
}

/* ---------- sign in / out ---------- */

type DecodedIdToken = Awaited<ReturnType<ReturnType<typeof adminAuth>["verifyIdToken"]>>;

/** Same identity rules for cookie sessions (web) and bearer tokens (native apps). */
function assertAcceptableIdentity(decoded: DecodedIdToken) {
  if (!ALLOWED_PROVIDERS.has(decoded.firebase.sign_in_provider)) throw forbidden("Unsupported sign-in method.");
  if (decoded.firebase.sign_in_provider === "password" && !decoded.email_verified) {
    throw forbidden("Please verify your email address first — check your inbox.", "EMAIL_NOT_VERIFIED");
  }
}

async function verifyIdTokenOr401(idToken: string) {
  return adminAuth()
    .verifyIdToken(idToken, true)
    .catch(() => {
      throw unauthorized("Your sign-in expired. Please try again.");
    });
}

/**
 * Exchanges a fresh Firebase ID token for a long-lived, httpOnly session cookie and makes sure
 * a matching row exists in our users table.
 */
export async function createSession(idToken: string) {
  const decoded = await verifyIdTokenOr401(idToken);
  assertAcceptableIdentity(decoded);
  if (Date.now() / 1000 - decoded.auth_time > MAX_AUTH_AGE_SEC) {
    throw new ApiError(401, "RECENT_SIGNIN_REQUIRED", "Please sign in again.");
  }

  const user = await upsertUser(decoded);
  const cookie = await adminAuth().createSessionCookie(idToken, { expiresIn: SESSION_TTL_MS });
  return { cookie, user };
}

/**
 * Native apps: no cookie. The app keeps its Firebase session (tokens auto-refresh hourly) and sends
 * `Authorization: Bearer <ID token>` on every request. This registers/refreshes the users row.
 */
export async function registerBearer(idToken: string) {
  const decoded = await verifyIdTokenOr401(idToken);
  assertAcceptableIdentity(decoded);
  return upsertUser(decoded);
}

async function upsertUser(decoded: DecodedIdToken): Promise<SessionUser> {
  const fallbackName = decoded.email?.split("@")[0]?.slice(0, 60) || "Neighbour";
  const name = (typeof decoded.name === "string" && decoded.name.trim().slice(0, 60)) || fallbackName;

  const [user] = await getDb()
    .insert(schema.users)
    .values({
      firebaseUid: decoded.uid,
      email: decoded.email ?? null,
      name,
      avatarUrl: typeof decoded.picture === "string" ? decoded.picture : null,
    })
    .onConflictDoUpdate({
      target: schema.users.firebaseUid,
      // Keep the profile the user edited; only sync the identity fields Firebase owns.
      set: { email: sql`excluded.email` },
    })
    .returning({ id: schema.users.id, firebaseUid: schema.users.firebaseUid, bannedAt: schema.users.bannedAt });
  // Suspended accounts can't start a new session either.
  if (user.bannedAt) throw forbidden(SUSPENDED_MESSAGE, "ACCOUNT_SUSPENDED");
  return { id: user.id, firebaseUid: user.firebaseUid };
}

/** Native sign-out: revoke the Firebase refresh tokens behind a bearer token. */
export async function revokeBearer(token: string | null) {
  if (!token) return;
  cache.delete(hashToken(token));
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    await adminAuth().revokeRefreshTokens(decoded.uid);
  } catch {
    // Already invalid — nothing to revoke.
  }
}

/** `Authorization: Bearer …` value, or null. */
export function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token && token.length <= 4096 ? token : null;
}

/** Signs the user out everywhere by revoking their Firebase refresh tokens. */
export async function destroySession(token: string | undefined) {
  if (!token) return;
  cache.delete(hashToken(token));
  try {
    const decoded = await adminAuth().verifySessionCookie(token);
    await adminAuth().revokeRefreshTokens(decoded.sub);
  } catch {
    // Already invalid — nothing to revoke.
  }
}

export function sessionCookieOptions(maxAgeMs = SESSION_TTL_MS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(maxAgeMs / 1000),
  };
}

/* ---------- per-request lookup ---------- */

/** Whether this request authenticates with a bearer token (native app) rather than the cookie. */
export const isBearerRequest = (req: NextRequest) => req.headers.has("authorization");

async function getBearerUser(token: string): Promise<SessionUser | null> {
  const key = hashToken(token);
  const cached = cacheGet(key);
  if (cached) return cached;

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(token, true);
    assertAcceptableIdentity(decoded);
    uid = decoded.uid;
  } catch {
    return null;
  }

  const row = await lookupUser(uid);
  if (!row) return null;

  cacheSet(key, row);
  return row;
}

async function lookupUser(firebaseUid: string): Promise<SessionUser | null> {
  const [row] = await getDb()
    .select({ id: schema.users.id, firebaseUid: schema.users.firebaseUid, bannedAt: schema.users.bannedAt })
    .from(schema.users)
    .where(eq(schema.users.firebaseUid, firebaseUid))
    .limit(1);
  return row ? { id: row.id, firebaseUid: row.firebaseUid, suspended: row.bannedAt !== null } : null;
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  // An Authorization header means "native client": the cookie is ignored entirely, which is what
  // makes skipping the CSRF Origin check safe for these requests (see lib/server/api.ts).
  if (isBearerRequest(req)) {
    const bearer = bearerToken(req);
    return bearer ? getBearerUser(bearer) : null;
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 4096) return null;

  const key = hashToken(token);
  const cached = cacheGet(key);
  if (cached) return cached;

  let uid: string;
  try {
    uid = (await adminAuth().verifySessionCookie(token, true)).uid;
  } catch {
    return null;
  }

  const row = await lookupUser(uid);
  if (!row) return null;

  cacheSet(key, row);
  return row;
}

export const SUSPENDED_MESSAGE = "Your account has been suspended for breaking our community guidelines.";

export async function requireUser(req: NextRequest): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) throw unauthorized();
  if (user.suspended) throw forbidden(SUSPENDED_MESSAGE, "ACCOUNT_SUSPENDED");
  return user;
}
