import Link from "next/link";
import { dismissListingReports, dismissUserReports, removeListing, suspendUser } from "@/app/actions";
import { ActionForm, inputCls } from "@/components/ActionForm";
import { Badge, Card, Empty, PageHeader, StatusBadge, Thumb, td, th } from "@/components/ui";
import { REASON_LABEL, timeAgo } from "@/lib/format";
import { reportedListings, reportedPeople } from "@/lib/queries";

export const metadata = { title: "Reports · Phenko Mat Admin" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const { tab = "listings", show = "open" } = (await searchParams) as { tab?: string; show?: string };
  const resolved = show === "resolved";
  const tabLink = (t: string, s = show) => `/reports?tab=${t}&show=${s}`;
  const pill = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? "bg-zinc-900 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:text-black"}`;

  return (
    <>
      <PageHeader title="Reports" subtitle="Most reported first. Removing a listing or suspending someone resolves their reports.">
        <div className="flex gap-2">
          <Link href={tabLink(tab, "open")} className={pill(!resolved)}>Open</Link>
          <Link href={tabLink(tab, "resolved")} className={pill(resolved)}>Resolved</Link>
        </div>
      </PageHeader>
      <div className="mb-4 flex gap-2">
        <Link href={tabLink("listings")} className={pill(tab === "listings")}>Listings</Link>
        <Link href={tabLink("people")} className={pill(tab === "people")}>People</Link>
      </div>
      {tab === "people" ? <PeopleReports resolved={resolved} /> : <ListingReports resolved={resolved} />}
    </>
  );
}

async function ListingReports({ resolved }: { resolved: boolean }) {
  const list = await reportedListings({ resolved, limit: 100 });
  return (
    <Card>
      {list.length === 0 ? (
        <Empty>{resolved ? "No resolved reports yet." : "No open listing reports. 🎉"}</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200">
            <tr>
              <th className={th}>Listing</th>
              <th className={th}>Owner</th>
              <th className={th}>Reports</th>
              <th className={th}>Latest</th>
              {!resolved && <th className={th}>Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {list.map((r) => (
              <tr key={r.item_id} className="align-top">
                <td className={td}>
                  <Link href={`/listings/${r.item_id}`} className="flex items-center gap-3">
                    <Thumb src={r.photo} alt={r.title} size={52} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold hover:underline">{r.title}</span>
                      <StatusBadge status={r.status} />
                    </span>
                  </Link>
                </td>
                <td className={td}>
                  <Link href={`/users/${r.owner_id}`} className="font-medium hover:underline">{r.owner_name}</Link>
                  {r.owner_banned && <div><Badge tone="red">suspended</Badge></div>}
                </td>
                <td className={td}>
                  <p className="text-lg font-black text-red-700">{r.report_count}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.reasons.map((x) => <Badge key={x} tone="amber">{REASON_LABEL[x] ?? x}</Badge>)}
                  </div>
                </td>
                <td className={`${td} whitespace-nowrap text-zinc-500`}>{timeAgo(r.latest_at)}</td>
                {!resolved && (
                  <td className={`${td} w-64`}>
                    <div className="flex flex-col gap-2">
                      {r.status !== "removed" && (
                        <ActionForm
                          action={removeListing}
                          fields={{ id: r.item_id }}
                          label="Remove listing"
                          pendingLabel="Removing…"
                          tone="danger"
                          confirm={`Remove “${r.title}”? It disappears from the app and its photos are deleted. This can't be undone.`}
                        >
                          <input name="reason" placeholder="Reason (optional)" maxLength={300} className={inputCls} />
                        </ActionForm>
                      )}
                      <ActionForm action={dismissListingReports} fields={{ id: r.item_id }} label="Dismiss reports" pendingLabel="Dismissing…" />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

async function PeopleReports({ resolved }: { resolved: boolean }) {
  const list = await reportedPeople({ resolved, limit: 100 });
  return (
    <Card>
      {list.length === 0 ? (
        <Empty>{resolved ? "No resolved reports yet." : "No open reports about people. 🎉"}</Empty>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200">
            <tr>
              <th className={th}>Person</th>
              <th className={th}>Reports</th>
              <th className={th}>On their listings</th>
              <th className={th}>Latest</th>
              {!resolved && <th className={th}>Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {list.map((p) => (
              <tr key={p.user_id} className="align-top">
                <td className={td}>
                  <Link href={`/users/${p.user_id}`} className="flex items-center gap-3">
                    <Thumb src={p.avatar_url} alt={p.name} size={40} round />
                    <span className="min-w-0">
                      <span className="block font-semibold hover:underline">{p.name}</span>
                      <span className="block truncate text-xs text-zinc-500">{p.email}</span>
                      {p.banned && <Badge tone="red">suspended</Badge>}
                    </span>
                  </Link>
                </td>
                <td className={td}>
                  <p className="text-lg font-black text-red-700">{p.report_count}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.reasons.map((x) => <Badge key={x} tone="amber">{REASON_LABEL[x] ?? x}</Badge>)}
                  </div>
                </td>
                <td className={`${td} text-zinc-600`}>{p.listing_report_count}</td>
                <td className={`${td} whitespace-nowrap text-zinc-500`}>{timeAgo(p.latest_at)}</td>
                {!resolved && (
                  <td className={`${td} w-64`}>
                    <div className="flex flex-col gap-2">
                      {!p.banned && (
                        <ActionForm
                          action={suspendUser}
                          fields={{ id: p.user_id }}
                          label="Suspend account"
                          pendingLabel="Suspending…"
                          tone="danger"
                          confirm={`Suspend ${p.name}? They're signed out, can't use the app, and their listings are hidden.`}
                        >
                          <input name="reason" required minLength={3} placeholder="Reason (required)" maxLength={300} className={inputCls} />
                        </ActionForm>
                      )}
                      <ActionForm action={dismissUserReports} fields={{ id: p.user_id }} label="Dismiss reports" pendingLabel="Dismissing…" />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
