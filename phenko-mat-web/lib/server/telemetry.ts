import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

/*
 * Errors and request stats for the admin panel (Errors and Health pages).
 *
 * - Errors are written straight away (fire-and-forget), at most MAX_PER_FINGERPRINT per minute per
 *   kind of error per server instance, so an outage can't flood the database with the same error.
 * - Request stats are counted in memory and flushed in one upsert every FLUSH_MS, so tracking adds
 *   no database write per request. (A crash can lose the last unflushed interval, which is fine.)
 */

export type ErrorSource = "api" | "realtime" | "web" | "mobile" | "cron";

export interface ErrorReport {
  source: ErrorSource;
  message: string;
  level?: "error" | "warn";
  route?: string | null;
  method?: string | null;
  status?: number | null;
  code?: string | null;
  stack?: string | null;
  userId?: string | null;
  meta?: Record<string, unknown> | null;
}

const MAX_PER_FINGERPRINT = 20;
const FLUSH_MS = 30_000;
export const SLOW_MS = 2_000;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** `/api/items/0193…/report` → `/api/items/:id/report`, so stats group by route, not by record. */
export function routePattern(pathname: string) {
  return pathname
    .replace(UUID, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:n")
    .slice(0, 200);
}

/** Same problem → same fingerprint, even when ids or numbers in the message differ. */
function fingerprint(r: ErrorReport) {
  const message = r.message.replace(UUID, ":id").replace(/\d+/g, "#").slice(0, 300);
  return createHash("sha256").update(`${r.source}|${r.route ?? ""}|${r.code ?? ""}|${message}`).digest("hex").slice(0, 32);
}

// One state object per process, shared by every route bundle.
interface State {
  errorBudget: Map<string, { minute: number; count: number }>;
  stats: Map<string, { minute: number; route: string; total: number; e4: number; e5: number; slow: number; sum: number; max: number }>;
  timer?: ReturnType<typeof setInterval>;
}
const g = globalThis as typeof globalThis & { __phenkoTelemetry?: State };
const state: State = (g.__phenkoTelemetry ??= { errorBudget: new Map(), stats: new Map() });

const currentMinute = () => Math.floor(Date.now() / 60_000);

export function recordError(report: ErrorReport) {
  try {
    const fp = fingerprint(report);
    const minute = currentMinute();
    const budget = state.errorBudget.get(fp);
    if (budget && budget.minute === minute) {
      if (budget.count >= MAX_PER_FINGERPRINT) return;
      budget.count++;
    } else {
      if (state.errorBudget.size > 1000) state.errorBudget.clear();
      state.errorBudget.set(fp, { minute, count: 1 });
    }
    void getDb()
      .insert(schema.errorEvents)
      .values({
        source: report.source,
        level: report.level ?? "error",
        fingerprint: fp,
        route: report.route?.slice(0, 200) ?? null,
        method: report.method?.slice(0, 10) ?? null,
        status: report.status ?? null,
        code: report.code?.slice(0, 60) ?? null,
        message: report.message.slice(0, 1000) || "(no message)",
        stack: report.stack?.slice(0, 8000) ?? null,
        userId: report.userId ?? null,
        meta: report.meta ? JSON.stringify(report.meta).slice(0, 2000) : null,
      })
      .catch((e) => console.error("[telemetry] error write failed", e));
  } catch (e) {
    console.error("[telemetry] recordError failed", e);
  }
}

export function recordRequest(route: string, status: number, durationMs: number) {
  const minute = currentMinute();
  const key = `${minute}|${route}`;
  let s = state.stats.get(key);
  if (!s) {
    s = { minute, route, total: 0, e4: 0, e5: 0, slow: 0, sum: 0, max: 0 };
    state.stats.set(key, s);
  }
  s.total++;
  if (status >= 500) s.e5++;
  else if (status >= 400) s.e4++;
  if (durationMs >= SLOW_MS) s.slow++;
  s.sum += Math.round(durationMs);
  s.max = Math.max(s.max, Math.round(durationMs));
  state.timer ??= setInterval(() => void flushStats(), FLUSH_MS);
  state.timer.unref?.();
  if (state.stats.size > 500) void flushStats();
}

export async function flushStats() {
  if (!state.stats.size) return;
  const rows = [...state.stats.values()];
  state.stats.clear();
  try {
    await getDb()
      .insert(schema.requestStats)
      .values(
        rows.map((r) => ({
          minute: new Date(r.minute * 60_000),
          route: r.route,
          total: r.total,
          errors4xx: r.e4,
          errors5xx: r.e5,
          slow: r.slow,
          durationMsSum: r.sum,
          durationMsMax: r.max,
        })),
      )
      .onConflictDoUpdate({
        target: [schema.requestStats.minute, schema.requestStats.route],
        set: {
          total: sql`${schema.requestStats.total} + excluded.total`,
          errors4xx: sql`${schema.requestStats.errors4xx} + excluded.errors_4xx`,
          errors5xx: sql`${schema.requestStats.errors5xx} + excluded.errors_5xx`,
          slow: sql`${schema.requestStats.slow} + excluded.slow`,
          durationMsSum: sql`${schema.requestStats.durationMsSum} + excluded.duration_ms_sum`,
          durationMsMax: sql`greatest(${schema.requestStats.durationMsMax}, excluded.duration_ms_max)`,
        },
      });
  } catch (e) {
    console.error("[telemetry] stats flush failed", e);
  }
}

/** Retention: errors 30 days, request stats 14 days (run by the daily cron). */
export async function pruneTelemetry() {
  const db = getDb();
  const [errors, stats] = await Promise.all([
    db.execute(sql`delete from error_events where created_at < now() - interval '30 days'`),
    db.execute(sql`delete from request_stats where minute < now() - interval '14 days'`),
  ]);
  return { errorsDeleted: errors.rowCount ?? 0, statsDeleted: stats.rowCount ?? 0 };
}
