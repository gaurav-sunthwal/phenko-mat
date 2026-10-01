import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Badge, Card, Empty, PageHeader, td, th } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { errorCountsBySource, errorGroups } from "@/lib/queries";

export const metadata = { title: "Errors · Phenko Mat Admin" };

const PERIODS = [
  [1, "1 hour"],
  [24, "24 hours"],
  [168, "7 days"],
  [720, "30 days"],
] as const;
const SOURCES = ["all", "api", "realtime", "web", "mobile", "cron"] as const;
const SOURCE_HELP: Record<string, string> = {
  api: "Server crashes while handling a request",
  realtime: "Chat gateway crashes",
  web: "Crashes in the website",
  mobile: "Crashes in the mobile app",
  cron: "Scheduled job failures",
};

export default async function ErrorsPage({ searchParams }: PageProps<"/errors">) {
  const { hours: h = "24", source = "all" } = (await searchParams) as { hours?: string; source?: string };
  const hours = PERIODS.some(([v]) => v === Number(h)) ? Number(h) : 24;
  const [groups, counts] = await Promise.all([errorGroups({ hours, source }), errorCountsBySource(hours)]);
  const total = counts.reduce((n, c) => n + c.events, 0);
  const link = (patch: Record<string, string | number>) => `/errors?${new URLSearchParams({ hours: String(hours), source, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) })}`;
  const pill = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-black"}`;

  return (
    <>
      <PageHeader title="Errors" subtitle="Everything that went wrong, grouped by kind. Most frequent first.">
        <AutoRefresh seconds={30} />
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {PERIODS.map(([v, label]) => (
          <Link key={v} href={link({ hours: v })} className={pill(hours === v)}>
            {label}
          </Link>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {SOURCES.map((s) => {
          const n = s === "all" ? total : (counts.find((c) => c.source === s)?.events ?? 0);
          return (
            <Link key={s} href={link({ source: s })} className={pill(source === s)} title={SOURCE_HELP[s]}>
              {s === "all" ? "All sources" : s} <span className={n ? "text-red-500" : "opacity-50"}>{n}</span>
            </Link>
          );
        })}
      </div>

      <Card>
        {groups.length === 0 ? (
          <Empty>No errors in this period. 🎉</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200">
              <tr>
                <th className={th}>Error</th>
                <th className={th}>Source</th>
                <th className={th}>Times</th>
                <th className={th}>Users hit</th>
                <th className={th}>Last seen</th>
                <th className={th}>First seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {groups.map((g) => (
                <tr key={g.fingerprint} className="align-top">
                  <td className={`${td} max-w-xl`}>
                    <Link href={`/errors/${g.fingerprint}`} className="block font-semibold break-words hover:underline">
                      {g.message}
                    </Link>
                    <span className="mt-0.5 block font-mono text-xs text-zinc-500">
                      {[g.route, g.code, g.status].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className={td}>
                    <Badge tone={g.source === "api" || g.source === "realtime" ? "red" : g.source === "cron" ? "amber" : "blue"}>{g.source}</Badge>
                  </td>
                  <td className={`${td} text-lg font-black text-red-700`}>{g.events}</td>
                  <td className={td}>{g.users}</td>
                  <td className={`${td} whitespace-nowrap text-zinc-600`}>{timeAgo(g.last_at)}</td>
                  <td className={`${td} whitespace-nowrap text-zinc-500`}>{timeAgo(g.first_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
