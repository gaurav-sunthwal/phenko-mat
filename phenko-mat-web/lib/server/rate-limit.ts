import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { tooManyRequests } from "./errors";

export interface RateLimit {
  /** Bucket name, e.g. "messages:send". */
  name: string;
  limit: number;
  windowSec: number;
  /**
   * "memory" (default): per-instance counter, zero latency — for hot paths (feed, chat, swipes).
   * "shared": Postgres counter shared by all instances, +1 DB round trip — for rare, abuse-prone
   * actions (sign-in, uploads, creating listings) where a precise global limit matters.
   * With Redis later, both become one shared, zero-cost counter.
   */
  store?: "memory" | "shared";
}

/* ---------- in-memory fixed window ---------- */

const MEMORY_MAX_KEYS = 50_000;
const counters = new Map<string, { windowStart: number; count: number }>();

function hitMemory(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const entry = counters.get(key);
  if (!entry || entry.windowStart !== windowStart) {
    if (counters.size >= MEMORY_MAX_KEYS) counters.delete(counters.keys().next().value!);
    counters.set(key, { windowStart, count: 1 });
    return 1;
  }
  entry.count++;
  return entry.count;
}

/* ---------- shared (Postgres) fixed window ---------- */

async function hitShared(key: string, windowMs: number) {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const result = await getDb().execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count)
    values (${key}, ${windowStart.toISOString()}, 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start = excluded.window_start then rate_limits.count + 1 else 1 end,
      window_start = excluded.window_start
    returning count
  `);
  // Opportunistic cleanup of expired windows, so the table stays small without a cron.
  if (Math.random() < 0.01) {
    void getDb().execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  }
  return Number(result.rows[0]?.count ?? 0);
}

export async function enforceRateLimit({ name, limit, windowSec, store = "memory" }: RateLimit, subject: string) {
  const key = `${name}:${subject}`.slice(0, 200);
  const windowMs = windowSec * 1000;
  const count = store === "shared" ? await hitShared(key, windowMs) : hitMemory(key, limit, windowMs);
  if (count > limit) throw tooManyRequests();
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
