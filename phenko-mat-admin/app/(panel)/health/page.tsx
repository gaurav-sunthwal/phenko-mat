import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Badge, Card, Empty, PageHeader, td, th } from "@/components/ui";
import { runHealthChecks, type CheckStatus } from "@/lib/health";
import { traffic } from "@/lib/queries";

export const metadata = { title: "Health · Phenko Mat Admin" };

const DOT: Record<CheckStatus, string> = { ok: "bg-emerald-500", slow: "bg-amber-500", down: "bg-red-600" };
const LABEL: Record<CheckStatus, string> = { ok: "Working", slow: "Slow", down: "Down" };
const pct = (part: number, total: number) => (total ? (part / total) * 100 : 0);
const fmtPct = (n: number) => (n === 0 ? "0%" : n < 0.1 ? "<0.1%" : `${n.toFixed(1)}%`);

export default async function HealthPage({ searchParams }: PageProps<"/health">) {
  const { hours: h = "24" } = (await searchParams) as { hours?: string };
  const hours = [1, 24, 168].includes(Number(h)) ? Number(h) : 24;
  const [checks, t] = await Promise.all([runHealthChecks(), traffic(hours)]);
  const overall: CheckStatus = checks.some((c) => c.status === "down") ? "down" : checks.some((c) => c.status === "slow") ? "slow" : "ok";
  const s = t.summary;
  const errorRate = pct(s.errors_5xx, s.total);
  const max = Math.max(1, ...t.series.map((x) => x.total));

  return (
    <>
      <PageHeader title="Health" subtitle="Is everything up, and how are requests doing?">
        <AutoRefresh seconds={30} />
      </PageHeader>

      <Card className={`mb-6 flex items-center gap-3 p-4 ${overall === "ok" ? "bg-emerald-50" : overall === "slow" ? "bg-amber-50" : "bg-red-50"}`}>
        <span className={`h-3 w-3 rounded-full ${DOT[overall]}`} />
        <p className="font-bold">
          {overall === "ok" ? "All systems working" : overall === "slow" ? "Working, but some parts are slow" : "Something is down"}
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {checks.map((c) => (
          <Card key={c.name} className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-bold">{c.name}</p>
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <span className={`h-2.5 w-2.5 rounded-full ${DOT[c.status]}`} /> {LABEL[c.status]}
              </span>
            </div>
            <p className="text-xs text-zinc-500">{c.description}</p>
            <p className="mt-3 text-2xl font-black">{c.ms} ms</p>
            {c.detail && <p className={`mt-1 text-xs ${c.status === "down" ? "font-medium text-red-700" : "text-zinc-600"}`}>{c.detail}</p>}
          </Card>
        ))}
      </div>

      <div className="mt-8 mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">API traffic</h2>
        <div className="flex gap-2">
          {[
            [1, "Last hour"],
            [24, "24 hours"],
            [168, "7 days"],
          ].map(([v, label]) => (
            <Link
              key={v}
              href={`/health?hours=${v}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${hours === v ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Requests" value={s.total.toLocaleString("en-IN")} />
        <Stat label="Server error rate" value={fmtPct(errorRate)} sub={`${s.errors_5xx} failed (5xx)`} alert={errorRate >= 1} />
        <Stat label="Client errors" value={fmtPct(pct(s.errors_4xx, s.total))} sub={`${s.errors_4xx} rejected (4xx)`} />
        <Stat label="Avg response" value={s.avg_ms === null ? "—" : `${s.avg_ms} ms`} sub={s.max_ms ? `slowest ${s.max_ms} ms` : undefined} />
        <Stat label="Slow requests" value={String(s.slow)} sub="over 2 s" alert={s.slow > 0 && pct(s.slow, s.total) >= 5} />
      </div>

      <Card className="mt-4 p-4">
        <div className="mb-3 flex gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-zinc-300" /> Requests</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Server errors</span>
        </div>
        {s.total === 0 ? (
          <Empty>No API traffic recorded in this period yet. Stats are flushed every 30 seconds.</Empty>
        ) : (
          <div className="flex h-36 items-end gap-0.5">
            {t.series.map((x) => (
              <div key={x.hour} className="relative flex flex-1 flex-col justify-end" title={`${x.hour}: ${x.total} requests, ${x.errors_5xx} server errors`}>
                <div className="rounded-t-sm bg-zinc-300" style={{ height: `${(x.total / max) * 100}%`, minHeight: x.total ? 2 : 0 }} />
                {x.errors_5xx > 0 && <div className="absolute bottom-0 w-full rounded-t-sm bg-red-500" style={{ height: `${(x.errors_5xx / max) * 100}%`, minHeight: 3 }} />}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <h2 className="border-b border-zinc-200 px-4 py-3 font-bold">Routes (most failures first)</h2>
          {t.routes.length === 0 ? (
            <Empty>No traffic yet.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Route</th>
                  <th className={th}>Requests</th>
                  <th className={th}>5xx</th>
                  <th className={th}>4xx</th>
                  <th className={th}>Avg</th>
                  <th className={th}>Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {t.routes.map((r) => {
                  const rate = pct(r.errors_5xx, r.total);
                  return (
                    <tr key={r.route}>
                      <td className={`${td} font-mono text-xs`}>{r.route}</td>
                      <td className={td}>{r.total}</td>
                      <td className={td}>{r.errors_5xx ? <Badge tone="red">{r.errors_5xx} · {fmtPct(rate)}</Badge> : <span className="text-zinc-400">0</span>}</td>
                      <td className={`${td} text-zinc-600`}>{r.errors_4xx}</td>
                      <td className={td}>{r.avg_ms} ms</td>
                      <td className={`${td} ${r.max_ms >= 2000 ? "font-semibold text-amber-700" : "text-zinc-600"}`}>{r.max_ms} ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
        <Card className="h-fit">
          <h2 className="border-b border-zinc-200 px-4 py-3 font-bold">Errors by source</h2>
          {t.errorsBySource.length === 0 ? (
            <Empty>No errors recorded. 🎉</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {t.errorsBySource.map((e) => (
                <li key={e.source}>
                  <Link href={`/errors?source=${e.source}&hours=${hours}`} className="flex justify-between px-4 py-2.5 hover:bg-zinc-50">
                    <span className="font-semibold">{e.source}</span>
                    <span className="font-bold text-red-700">{e.events}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <Card className={`p-4 ${alert ? "ring-2 ring-red-300" : ""}`}>
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className={`mt-1 text-2xl font-black ${alert ? "text-red-700" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </Card>
  );
}
