import Link from "next/link";
import { notFound } from "next/navigation";
import { dismissListingReports, removeListing } from "@/app/actions";
import { ActionForm, inputCls } from "@/components/ActionForm";
import { ReportList } from "@/components/ReportList";
import { Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { formatDateTime, formatPrice } from "@/lib/format";
import { listingDetail, reportsForItem } from "@/lib/queries";

export const metadata = { title: "Listing · Phenko Mat Admin" };

export default async function ListingDetailPage({ params }: PageProps<"/listings/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [item, reports] = await Promise.all([listingDetail(id), reportsForItem(id)]);
  if (!item) notFound();
  const open = reports.filter((r) => !r.resolved_at).length;

  return (
    <>
      <Link href="/listings" className="text-sm font-semibold text-zinc-500 hover:text-black">← Listings</Link>
      <PageHeader title={item.title} subtitle={`Listing ${item.id}`} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="p-4">
            {item.status === "removed" ? (
              <p className="text-sm text-zinc-500">Photos were deleted when this listing was removed.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {item.photos.map((src, i) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-lg bg-zinc-100 object-cover" />
                  </a>
                ))}
              </div>
            )}
          </Card>
          <Card className="p-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
              <Field label="Status"><StatusBadge status={item.status} /></Field>
              <Field label="Price">{formatPrice(item.price_inr)}</Field>
              <Field label="Condition">{item.condition.replace("_", " ")}</Field>
              <Field label="Area">{item.area}</Field>
              <Field label="Listed">{formatDateTime(item.created_at)}</Field>
              <Field label="Last updated">{formatDateTime(item.updated_at)}</Field>
              <Field label="Chats">{item.connections}</Field>
              <Field label="Views">{item.views}</Field>
              {item.given_to_name && <Field label="Given to">{item.given_to_name}</Field>}
            </dl>
            <p className="mt-4 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Categories</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(item.categories ?? []).map((c) => <Badge key={c}>{c}</Badge>)}
            </div>
            <p className="mt-4 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Description</p>
            <p className="mt-1 text-sm whitespace-pre-line text-zinc-700">{item.description || "—"}</p>
          </Card>
          <Card>
            <h2 className="border-b border-zinc-200 px-4 py-3 font-bold">Reports ({reports.length}, {open} open)</h2>
            <ReportList reports={reports} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Owner</p>
            <Link href={`/users/${item.owner_id}`} className="mt-1 block font-semibold hover:underline">{item.owner_name}</Link>
            <p className="text-sm text-zinc-500">{item.owner_email}</p>
            {item.owner_banned && <Badge tone="red">suspended</Badge>}
          </Card>
          <Card className="space-y-3 p-4">
            <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Actions</p>
            {item.status !== "removed" ? (
              <ActionForm
                action={removeListing}
                fields={{ id: item.id }}
                label="Remove listing"
                pendingLabel="Removing…"
                tone="danger"
                confirm={`Remove “${item.title}”? It disappears from the app and its photos are deleted. This can't be undone.`}
              >
                <input name="reason" placeholder="Reason (optional, for the audit log)" maxLength={300} className={inputCls} />
              </ActionForm>
            ) : (
              <p className="text-sm text-zinc-500">This listing has been removed.</p>
            )}
            {open > 0 && <ActionForm action={dismissListingReports} fields={{ id: item.id }} label={`Dismiss ${open} open report${open === 1 ? "" : "s"}`} />}
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
