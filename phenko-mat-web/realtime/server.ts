/**
 * Phenko Mat realtime gateway: holds WebSocket connections and pushes chat events.
 *
 *   browser ──(HTTPS)──► Next.js API ──► Postgres            (all writes, source of truth)
 *                              │
 *                              └─(internal HTTP publish)──► gateway ──(WebSocket)──► browsers
 *
 * Browsers only *receive* over the socket (plus lightweight typing signals). Anything missed while
 * disconnected is re-fetched over HTTP using the message cursor, so delivery here can be best-effort.
 *
 * Run: pnpm dev (with Next) or pnpm dev:realtime.
 */
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { neon } from "@neondatabase/serverless";
import { WebSocket, WebSocketServer } from "ws";
import { CLOSE, type ClientEvent, type PublishRequest, type ServerEvent } from "../lib/realtime/protocol";
import { secretsMatch, verifyTicket, TICKET_TTL_SEC } from "../lib/realtime/ticket";
import { LocalBroker, type Broker } from "./broker";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Env comes from the platform in production.
}

/* ---------- config ---------- */

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

const PORT = Number(process.env.REALTIME_PORT ?? process.env.PORT ?? 3001);
const SECRET = required("REALTIME_SECRET");
if (SECRET.length < 32) throw new Error("REALTIME_SECRET must be at least 32 characters");
const ALLOWED_ORIGINS = new Set(
  (process.env.REALTIME_ALLOWED_ORIGINS ?? process.env.APP_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);
const sql = neon(required("DATABASE_URL"));

const HEARTBEAT_MS = 30_000;
const MAX_PAYLOAD = 4 * 1024;
const MAX_SOCKETS_PER_USER = 10;
const MAX_BUFFERED_BYTES = 1 << 20;
/** Per-socket inbound budget: 20 frames per 10 s. */
const FLOOD_LIMIT = 20;
const FLOOD_WINDOW_MS = 10_000;
const TYPING_MIN_INTERVAL_MS = 1_500;
const MAX_PUBLISH_BYTES = 64 * 1024;

/* ---------- connected clients ---------- */

interface Client {
  ws: WebSocket;
  userId: string;
  alive: boolean;
  frames: number;
  windowStart: number;
  lastTyping: Map<string, number>;
}

const byUser = new Map<string, Set<Client>>();

function send(client: Client, event: ServerEvent) {
  if (client.ws.readyState !== WebSocket.OPEN) return;
  // Backpressure: a client that can't keep up gets dropped and will resync on reconnect.
  if (client.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
    client.ws.terminate();
    return;
  }
  client.ws.send(JSON.stringify(event));
}

function deliverLocal(userId: string, event: ServerEvent) {
  byUser.get(userId)?.forEach((c) => send(c, event));
}

const broker: Broker = new LocalBroker(deliverLocal);

/* ---------- single-use tickets ---------- */

// nonce → expiry. Single instance, so memory is enough; RedisBroker era → SET NX EX in Redis.
const usedNonces = new Map<string, number>();
setInterval(() => {
  const now = Date.now();
  for (const [nonce, exp] of usedNonces) if (exp < now) usedNonces.delete(nonce);
}, 30_000).unref();

/* ---------- membership cache (authorizes typing signals) ---------- */

const MEMBERSHIP_TTL_MS = 5 * 60_000;
const MEMBERSHIP_MAX = 50_000;
const membership = new Map<string, { parties: [string, string] | null; expires: number }>();

async function partiesOf(connectionId: string): Promise<[string, string] | null> {
  const hit = membership.get(connectionId);
  if (hit && hit.expires > Date.now()) return hit.parties;
  const rows = (await sql`select taker_id, giver_id from connections where id = ${connectionId}`) as {
    taker_id: string;
    giver_id: string;
  }[];
  const parties: [string, string] | null = rows[0] ? [rows[0].taker_id, rows[0].giver_id] : null;
  if (membership.size >= MEMBERSHIP_MAX) membership.delete(membership.keys().next().value!);
  membership.set(connectionId, { parties, expires: Date.now() + MEMBERSHIP_TTL_MS });
  return parties;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function onClientEvent(client: Client, raw: string) {
  let event: ClientEvent;
  try {
    event = JSON.parse(raw) as ClientEvent;
  } catch {
    return;
  }
  if (event?.type !== "typing" || typeof event.connectionId !== "string" || !UUID_RE.test(event.connectionId)) return;

  const now = Date.now();
  if (now - (client.lastTyping.get(event.connectionId) ?? 0) < TYPING_MIN_INTERVAL_MS) return;
  client.lastTyping.set(event.connectionId, now);

  const parties = await partiesOf(event.connectionId).catch(() => null);
  if (!parties || !parties.includes(client.userId)) return; // not their chat — silently ignore
  const other = parties[0] === client.userId ? parties[1] : parties[0];
  await broker.publish([other], { type: "typing", connectionId: event.connectionId, userId: client.userId });
}

/* ---------- HTTP: health + internal publish ---------- */

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_PUBLISH_BYTES) throw new Error("too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://gateway");

  if (req.method === "GET" && url.pathname === "/healthz") {
    let sockets = 0;
    byUser.forEach((set) => (sockets += set.size));
    return json(res, 200, { ok: true, users: byUser.size, sockets });
  }

  if (req.method === "POST" && url.pathname === "/internal/publish") {
    const auth = req.headers.authorization ?? "";
    if (!secretsMatch(auth, `Bearer ${SECRET}`)) return json(res, 401, { error: "unauthorized" });
    try {
      const body = JSON.parse(await readBody(req)) as PublishRequest;
      if (!Array.isArray(body.userIds) || !body.event?.type) return json(res, 400, { error: "bad request" });
      // A deleted chat must stop relaying typing signals right away, not when the cache entry expires.
      if (body.event.type === "connection.removed") membership.delete(body.event.connectionId);
      await broker.publish(body.userIds.slice(0, 100), body.event);
      return json(res, 202, { ok: true });
    } catch {
      return json(res, 400, { error: "bad request" });
    }
  }

  json(res, 404, { error: "not found" });
});

/* ---------- WebSocket upgrade ---------- */

const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD, perMessageDeflate: false });

server.on("upgrade", (req, socket, head) => {
  const reject = (status: number, reason: string) => {
    socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
  };

  const url = new URL(req.url ?? "/", "http://gateway");
  if (url.pathname !== "/ws") return reject(404, "Not Found");

  const claims = verifyTicket(url.searchParams.get("ticket") ?? "", SECRET);
  if (!claims || usedNonces.has(claims.nonce)) return reject(401, "Unauthorized");

  // Browsers always send Origin on WebSocket handshakes; blocks cross-site socket hijacking.
  // Native-app tickets (signed, so `nat` can't be forged) come from bearer auth and have no web origin.
  const origin = req.headers.origin;
  if (!claims.nat && (!origin || !ALLOWED_ORIGINS.has(origin))) return reject(403, "Forbidden");
  usedNonces.set(claims.nonce, Date.now() + TICKET_TTL_SEC * 1000);

  const existing = byUser.get(claims.sub);
  if (existing && existing.size >= MAX_SOCKETS_PER_USER) return reject(429, "Too Many Connections");

  wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, claims.sub));
});

function onConnection(ws: WebSocket, userId: string) {
  const client: Client = { ws, userId, alive: true, frames: 0, windowStart: Date.now(), lastTyping: new Map() };

  let set = byUser.get(userId);
  if (!set) {
    set = new Set();
    byUser.set(userId, set);
    void broker.onUserOnline(userId);
  }
  set.add(client);

  ws.on("pong", () => {
    client.alive = true;
  });

  ws.on("message", (data, isBinary) => {
    const now = Date.now();
    if (now - client.windowStart > FLOOD_WINDOW_MS) {
      client.windowStart = now;
      client.frames = 0;
    }
    if (++client.frames > FLOOD_LIMIT) return ws.close(CLOSE.POLICY, "rate limited");
    if (isBinary) return;
    void onClientEvent(client, data.toString());
  });

  ws.on("close", () => {
    const current = byUser.get(userId);
    current?.delete(client);
    if (current && current.size === 0) {
      byUser.delete(userId);
      void broker.onUserOffline(userId);
    }
  });

  ws.on("error", () => ws.terminate());
  send(client, { type: "ready", userId });
}

// Heartbeat: drop sockets that stopped answering pings (dead mobile connections, sleeping laptops).
const heartbeat = setInterval(() => {
  byUser.forEach((set) =>
    set.forEach((client) => {
      if (!client.alive) return client.ws.terminate();
      client.alive = false;
      client.ws.ping();
    }),
  );
}, HEARTBEAT_MS);

server.listen(PORT, () => {
  console.log(`[realtime] listening on :${PORT} (origins: ${[...ALLOWED_ORIGINS].join(", ")})`);
});

// Graceful shutdown: tell clients to reconnect (to another instance) instead of silently dying.
function shutdown() {
  clearInterval(heartbeat);
  byUser.forEach((set) => set.forEach((c) => c.ws.close(CLOSE.RESTART, "restarting")));
  server.close();
  void broker.close();
  setTimeout(() => process.exit(0), 2_000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

/*
 * Crashes and stray rejections go to the same error_events table the API uses (admin Errors page).
 * Capped per message per minute so a crash loop can't flood the database.
 */
const errorBudget = new Map<string, { minute: number; count: number }>();
function reportError(error: unknown, kind: string): Promise<unknown> {
  const message = error instanceof Error ? error.message : String(error);
  const fingerprint = createHash("sha256")
    .update(`realtime|${kind}|${message.replace(/\d+/g, "#").slice(0, 300)}`)
    .digest("hex")
    .slice(0, 32);
  const minute = Math.floor(Date.now() / 60_000);
  const budget = errorBudget.get(fingerprint);
  if (budget?.minute === minute && budget.count >= 20) return Promise.resolve();
  errorBudget.set(fingerprint, { minute, count: budget?.minute === minute ? budget.count + 1 : 1 });
  const stack = error instanceof Error ? (error.stack ?? null)?.slice(0, 8000) ?? null : null;
  return sql`insert into error_events (source, level, fingerprint, route, code, message, stack)
           values ('realtime', 'error', ${fingerprint}, 'gateway', ${kind}, ${message.slice(0, 1000) || "(no message)"}, ${stack})`.catch(
    (e) => console.error("[realtime] error report failed", e),
  );
}
// Same behaviour as Node's default (crash so the process manager restarts a clean gateway), but the
// error is recorded first (bounded wait).
function crash(error: unknown, kind: string) {
  console.error(`[realtime] ${kind}`, error);
  setTimeout(() => process.exit(1), 3_000).unref();
  void reportError(error, kind).finally(() => process.exit(1));
}
process.on("uncaughtException", (error) => crash(error, "UNCAUGHT_EXCEPTION"));
process.on("unhandledRejection", (reason) => crash(reason, "UNHANDLED_REJECTION"));
