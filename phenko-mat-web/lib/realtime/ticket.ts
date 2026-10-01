import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Short-lived, single-use WebSocket tickets.
 *
 * Browsers can't set headers on a WebSocket handshake and the gateway lives on another origin,
 * so instead of forwarding the session cookie we mint a 60-second HMAC-signed ticket over HTTPS
 * (where the session is fully verified) and pass it in the connection URL.
 */

export const TICKET_TTL_SEC = 60;

export interface TicketClaims {
  sub: string;
  exp: number;
  nonce: string;
  /**
   * Issued to a native app (bearer auth). Native sockets have no meaningful Origin, and the
   * Origin check only guards against browser cookie hijacking, which bearer tickets can't suffer.
   */
  nat?: true;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function createTicket(userId: string, secret: string, now = Date.now(), native = false): string {
  const claims: TicketClaims = {
    sub: userId,
    exp: Math.floor(now / 1000) + TICKET_TTL_SEC,
    nonce: randomBytes(12).toString("base64url"),
    ...(native && { nat: true as const }),
  };
  const payload = b64(JSON.stringify(claims));
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the claims if the signature is valid and not expired; null otherwise. */
export function verifyTicket(ticket: string, secret: string, now = Date.now()): TicketClaims | null {
  if (ticket.length > 512) return null;
  const [payload, sig] = ticket.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as TicketClaims;
    if (typeof claims.sub !== "string" || typeof claims.nonce !== "string") return null;
    if (claims.exp < Math.floor(now / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Constant-time comparison for the internal publish secret. */
export function secretsMatch(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
