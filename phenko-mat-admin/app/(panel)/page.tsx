import Link from "next/link";
import { Card, Empty, PageHeader, Thumb, td, th } from "@/components/ui";
import { REASON_LABEL, timeAgo } from "@/lib/format";
import { dashboardStats, reportedListings } from "@/lib/queries";

export default async function DashboardPage() {
  const [{ stats, daily }, topReported] = await Promise.all([dashboardStats(), reportedListings({ limit: 5 })]);
  const max = Math.max(1, ...daily.map((d) => Math.max(d.signups, d.listings)));

  const cards = [
    { label: "Users", value: stats.users, sub: `+${stats.users_7d} this week` },
    { label: "Active listings", value: stats.active_listings, sub: `+${stats.listings_7d} new this week` },
    { label: "Passed on", value: stats.given, sub: "all time" },
    { label: "Connections", value: stats.connections, sub: `+${stats.connections_7d} this week` },
    { label: "Messages", value: stats.messages_7d, sub: "last 7 days" },
    { label: "Suspended", value: stats.suspended, sub: "accounts", href: "/users?filter=suspended" },
    { label: "Reported listings", value: stats.open_listing_reports, sub: "need review", href: "/reports", alert: stats.open_listing_reports > 0 },
    { label: "Reported people", value: stats.open_person_reports, sub: "need review", href: "/reports?tab=people", alert: stats.open_person_reports > 0 },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="How Phenko Mat is doing, and what needs your attention." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => {
          const body = (
            <Card className={`h-full p-4 ${c.alert ? "ring-2 ring-red-300" : ""}`}>
              <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{c.label}</p>
              <p className={`mt-1 text-3xl font-black ${c.alert ? "text-red-700" : ""}`}>{c.value.toLocaleString("en-IN")}</p>
              <p className="mt-1 text-xs text-zinc-500">{c.sub}</p>
            </Card>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="block hover:opacity-90">
              {body}
            </Link>
          ) : (
            <div key={c.label}>{body}</div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Last 14 days</h2>
            <div className="flex gap-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Sign-ups</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-zinc-800" /> Listings</span>
            </div>
          </div>
          <div className="flex h-40 items-end gap-1.5">
            {daily.map((d) => (
              <div key={d.day} className="flex flex-1 items-end justify-center gap-0.5" title={`${d.day}: ${d.signups} sign-ups, ${d.listings} listings`}>
                <div className="w-1/2 rounded-t bg-amber-400" style={{ height: `${(d.signups / max) * 100}%`, minHeight: d.signups ? 3 : 0 }} />
                <div className="w-1/2 rounded-t bg-zinc-800" style={{ height: `${(d.listings / max) * 100}%`, minHeight: d.listings ? 3 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
            <span>{daily[0]?.day}</span>
            <span>today</span>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="font-bold">Most reported listings</h2>
            <Link href="/reports" className="text-sm font-semibold text-zinc-600 hover:text-black">
              Review all →
            </Link>
          </div>
          {topReported.length === 0 ? (
            <Empty>No open reports. 🎉</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Listing</th>
                  <th className={th}>Reports</th>
                  <th className={th}>Latest</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {topReported.map((r) => (
                  <tr key={r.item_id}>
                    <td className={td}>
                      <Link href={`/listings/${r.item_id}`} className="flex items-center gap-3 font-semibold hover:underline">
                        <Thumb src={r.photo} alt={r.title} size={36} />
                        <span className="truncate">{r.title}</span>
                      </Link>
                    </td>
                    <td className={td}>
                      <span className="font-bold text-red-700">{r.report_count}</span>{" "}
                      <span className="text-xs text-zinc-500">{r.reasons.map((x) => REASON_LABEL[x] ?? x).join(", ")}</span>
                    </td>
                    <td className={`${td} text-zinc-500`}>{timeAgo(r.latest_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
