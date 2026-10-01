import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { env } from "./env";
import { adminAuth } from "./firebase-admin";
import { pingR2 } from "./r2";

const TIMEOUT_MS = 6_000;
/** Slower than this counts as "degraded" (still working, but users will feel it). */
const SLOW_MS = 1_500;

export type CheckStatus = "ok" | "slow" | "down";

export interface Check {
  name: string;
  description: string;
  status: CheckStatus;
  ms: number;
  detail?: string;
}

async function run(name: string, description: string, fn: () => Promise<string | void>): Promise<Check> {
  const started = performance.now();
  try {
    const detail = await Promise.race([
      fn(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`No response after ${TIMEOUT_MS / 1000} s`)), TIMEOUT_MS)),
    ]);
    const ms = Math.round(performance.now() - started);
    return { name, description, status: ms > SLOW_MS ? "slow" : "ok", ms, detail: detail || undefined };
  } catch (e) {
    return { name, description, status: "down", ms: Math.round(performance.now() - started), detail: e instanceof Error ? e.message : String(e) };
  }
}

interface WebHealth {
  status: string;
  api: { uptimeSec: number; memoryMb: number; node: string };
  database: { ok: boolean; ms: number; error?: string };
  realtime: { ok: boolean; ms: number; connectedUsers?: number; sockets?: number; error?: string };
}

/** Live checks of every moving part, run in parallel, each with a timeout so one dead service can't hang the page. */
export async function runHealthChecks(): Promise<Check[]> {
  let web: WebHealth | null = null;
  const webCheck = run("Web app & API", "The Next.js server the website and mobile app talk to", async () => {
    const res = await fetch(new URL("/api/health", env().WEB_APP_URL), { cache: "no-store" });
    web = (await res.json().catch(() => null)) as WebHealth | null;
    if (!web) throw new Error(`HTTP ${res.status}, no health report`);
    const mins = Math.round(web.api.uptimeSec / 60);
    return `Up ${mins < 120 ? `${mins} min` : `${Math.round(mins / 60)} h`} · ${web.api.memoryMb} MB memory · Node ${web.api.node}`;
  });

  const [db, api, storage, auth] = await Promise.all([
    run("Database", "Neon Postgres, measured from the admin server", async () => {
      const r = await getDb().execute<{ size: string; connections: number }>(sql`
        select pg_size_pretty(pg_database_size(current_database())) as size,
               (select count(*)::int from pg_stat_activity where datname = current_database()) as connections`);
      return `${r.rows[0]?.size} used · ${r.rows[0]?.connections} open connections`;
    }),
    webCheck,
    run("Photo storage", "Cloudflare R2 bucket", () => pingR2()),
    run("Sign-in", "Firebase Authentication", async () => {
      await adminAuth().listUsers(1);
    }),
  ]);

  // The realtime gateway is only reachable from the web server's network, so its status comes from there.
  const w = web as WebHealth | null;
  const realtime: Check =
    api.status === "down" || !w
      ? { name: "Realtime chat", description: "WebSocket gateway for live chat", status: "down", ms: 0, detail: "Unknown: the web app didn't answer" }
      : {
          name: "Realtime chat",
          description: "WebSocket gateway for live chat",
          status: !w.realtime.ok ? "down" : w.realtime.ms > SLOW_MS ? "slow" : "ok",
          ms: w.realtime.ms,
          detail: w.realtime.ok ? `${w.realtime.connectedUsers ?? 0} people connected · ${w.realtime.sockets ?? 0} sockets` : w.realtime.error,
        };
  const apiDb: Check | null = w
    ? {
        name: "Database (from API)",
        description: "Same database, as the web app sees it",
        status: !w.database.ok ? "down" : w.database.ms > SLOW_MS ? "slow" : "ok",
        ms: w.database.ms,
        detail: w.database.ok ? undefined : w.database.error,
      }
    : null;

  return [api, db, ...(apiDb ? [apiDb] : []), realtime, storage, auth];
}
