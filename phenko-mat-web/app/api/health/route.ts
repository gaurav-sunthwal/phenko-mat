import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { realtimeEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 3_000;
const started = Date.now();

async function timed<T>(fn: () => Promise<T>) {
  const t = performance.now();
  try {
    const value = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${TIMEOUT_MS} ms`)), TIMEOUT_MS)),
    ]);
    return { ok: true as const, ms: Math.round(performance.now() - t), value };
  } catch (e) {
    return { ok: false as const, ms: Math.round(performance.now() - t), error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Liveness + dependencies, for uptime monitors and the admin Health page: the API itself, the
 * database and the realtime (chat) gateway. 200 when everything is up, 503 otherwise.
 */
export async function GET() {
  const [db, realtime] = await Promise.all([
    timed(() => getDb().execute(sql`select 1`)),
    timed(async () => {
      const res = await fetch(new URL("/healthz", realtimeEnv().REALTIME_INTERNAL_URL), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { users: number; sockets: number };
    }),
  ]);
  const ok = db.ok && realtime.ok;
  const mem = process.memoryUsage();
  return Response.json(
    {
      status: ok ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
      api: { ok: true, uptimeSec: Math.round((Date.now() - started) / 1000), memoryMb: Math.round(mem.rss / 1048576), node: process.version },
      database: { ok: db.ok, ms: db.ms, ...(db.ok ? {} : { error: db.error }) },
      realtime: realtime.ok
        ? { ok: true, ms: realtime.ms, connectedUsers: realtime.value.users, sockets: realtime.value.sockets }
        : { ok: false, ms: realtime.ms, error: realtime.error },
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
