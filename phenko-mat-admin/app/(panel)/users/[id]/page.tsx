import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteUser, dismissUserReports, removeListing, suspendUser, unsuspendUser } from "@/app/actions";
import { ActionForm, inputCls } from "@/components/ActionForm";
import { ReportList } from "@/components/ReportList";
import { Badge, Card, Empty, PageHeader, StatusBadge, Thumb, td, th } from "@/components/ui";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { reportsAgainstUser, userDetail, userListings } from "@/lib/queries";

export const metadata = { title: "User · Phenko Mat Admin" };

export default async function UserDetailPage({ params }: PageProps<"/users/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [user, listings, reports] = await Promise.all([userDetail(id), userListings(id), reportsAgainstUser(id)]);
  if (!user) notFound();
  const openPersonReports = reports.filter((r) => !r.resolved_at && !r.item_id).length;

  const stats = [
    ["Listed", user.listed],
    ["Given away", user.given],
    ["Received", user.got],
    ["Chats", user.connections],
    ["Messages sent", user.messages],
    ["Reports made", user.reports_made],
    ["Blocked by", user.blocked_by],
  ] as const;

  return (
    <>
      <Link href="/users" className="text-sm font-semibold text-zinc-500 hover:text-black">← Users</Link>
      <PageHeader title={user.name} subtitle={`User ${user.id}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="flex gap-5 p-5">
            <Thumb src={user.avatar_url} alt={user.name} size={72} round />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{user.email ?? "No email"}</p>
              <p className="text-zinc-500">
                {user.area ?? "No location"} · {user.radius_km} km radius · joined {formatDate(user.created_at)}
              </p>
              {user.bio && <p className="mt-2 text-zinc-700">{user.bio}</p>}
              {user.banned_at && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-red-800">
                  <strong>Suspended</strong> {formatDateTime(user.banned_at)} — {user.ban_reason}
                </p>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-3 md:grid-cols-7">
            {stats.map(([label, value]) => (
              <Card key={label} className="p-3 text-center">
                <p className="text-xl font-black">{value}</p>
                <p className="text-[11px] font-semibold text-zinc-500">{label}</p>
              </Card>
            ))}
          </div>

          <Card>
            <h2 className="border-b border-zinc-200 px-4 py-3 font-bold">Listings ({listings.length})</h2>
            {listings.length === 0 ? (
              <Empty>No listings.</Empty>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className={th}>Listing</th>
                    <th className={th}>Price</th>
                    <th className={th}>Chats</th>
                    <th className={th}>Open reports</th>
                    <th className={th}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {listings.map((l) => (
                    <tr key={l.id}>
                      <td className={td}>
                        <Link href={`/listings/${l.id}`} className="flex items-center gap-3">
                          <Thumb src={l.photo} alt={l.title} size={36} />
                          <span className="truncate font-semibold hover:underline">{l.title}</span>
                          <StatusBadge status={l.status} />
                        </Link>
                      </td>
                      <td className={td}>{formatPrice(l.price_inr)}</td>
                      <td className={td}>{l.connections}</td>
                      <td className={td}>{l.open_reports ? <Badge tone="red">{l.open_reports}</Badge> : <span className="text-zinc-400">0</span>}</td>
                      <td className={td}>
                    {l.status === "removed" ? (
                      <span className="text-xs text-zinc-400">Removed</span>
                    ) : (
                      <ActionForm
                        action={removeListing}
                        fields={{ id: l.id }}
                        label="Remove"
                        pendingLabel="Removing…"
                        tone="danger"
                        confirm={`Remove “${l.title}”? It disappears from the app and its photos are deleted. This can't be undone.`}
                      />
                    )}
                  </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card>
            <h2 className="border-b border-zinc-200 px-4 py-3 font-bold">Reports about {user.name.split(" ")[0]} ({reports.length})</h2>
            <ReportList reports={reports} showItem />
          </Card>
        </div>

        <Card className="h-fit space-y-5 p-4">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Actions</p>
          {user.banned_at ? (
            <ActionForm action={unsuspendUser} fields={{ id: user.id }} label="Lift suspension" pendingLabel="Lifting…" tone="primary"
              confirm={`Let ${user.name} use the app again?`} />
          ) : (
            <ActionForm action={suspendUser} fields={{ id: user.id }} label="Suspend account" pendingLabel="Suspending…" tone="danger"
              confirm={`Suspend ${user.name}? They're signed out, can't use the app, and their listings are hidden.`}>
              <input name="reason" required minLength={3} maxLength={300} placeholder="Reason (required)" className={inputCls} />
            </ActionForm>
          )}
          {openPersonReports > 0 && (
            <ActionForm action={dismissUserReports} fields={{ id: user.id }} label={`Dismiss ${openPersonReports} open report${openPersonReports === 1 ? "" : "s"}`} />
          )}
          <div className="border-t border-zinc-200 pt-4">
            <p className="mb-2 text-xs text-zinc-500">
              Permanently deletes the account, listings, chats, photos and Firebase login. Can&apos;t be undone.
            </p>
            <ActionForm action={deleteUser} fields={{ id: user.id }} label="Delete account" pendingLabel="Deleting…" tone="danger"
              confirm={`Permanently delete ${user.name}'s account and everything they own?`}>
              <input name="confirm" required placeholder='Type "DELETE"' autoComplete="off" className={inputCls} />
            </ActionForm>
          </div>
        </Card>
      </div>
    </>
  );
}
