import Link from "next/link";
import { removeListing } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { SearchBar } from "@/components/SearchBar";
import { Badge, Card, Empty, PageHeader, Pagination, StatusBadge, Thumb, td, th } from "@/components/ui";
import { formatPrice, timeAgo } from "@/lib/format";
import { PAGE_SIZE, listListings } from "@/lib/queries";

export const metadata = { title: "Listings · Phenko Mat Admin" };

export default async function ListingsPage({ searchParams }: PageProps<"/listings">) {
  const { q, status = "all", page = "1" } = (await searchParams) as { q?: string; status?: string; page?: string };
  const p = Math.max(1, Number(page) || 1);
  const list = await listListings({ q: q?.trim() || undefined, status, page: p });

  return (
    <>
      <PageHeader title="Listings" subtitle="Search by title, description, owner name or listing id.">
        <SearchBar
          q={q}
          placeholder="Search listings…"
          filter={{
            name: "status",
            value: status,
            options: [
              { value: "all", label: "All statuses" },
              { value: "active", label: "Active" },
              { value: "given", label: "Given" },
              { value: "removed", label: "Removed" },
            ],
          }}
        />
      </PageHeader>
      <Card>
        {list.length === 0 ? (
          <Empty>No listings match.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200">
              <tr>
                <th className={th}>Listing</th>
                <th className={th}>Owner</th>
                <th className={th}>Price</th>
                <th className={th}>Area</th>
                <th className={th}>Chats</th>
                <th className={th}>Open reports</th>
                <th className={th}>Listed</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {list.map((l) => (
                <tr key={l.id}>
                  <td className={td}>
                    <Link href={`/listings/${l.id}`} className="flex items-center gap-3">
                      <Thumb src={l.photo} alt={l.title} size={40} />
                      <span className="min-w-0">
                        <span className="block max-w-xs truncate font-semibold hover:underline">{l.title}</span>
                        <StatusBadge status={l.status} />
                      </span>
                    </Link>
                  </td>
                  <td className={td}>
                    <Link href={`/users/${l.owner_id}`} className="hover:underline">{l.owner_name}</Link>
                  </td>
                  <td className={td}>{formatPrice(l.price_inr)}</td>
                  <td className={`${td} max-w-40 truncate text-zinc-600`}>{l.area}</td>
                  <td className={td}>{l.connections}</td>
                  <td className={td}>{l.open_reports ? <Badge tone="red">{l.open_reports}</Badge> : <span className="text-zinc-400">0</span>}</td>
                  <td className={`${td} whitespace-nowrap text-zinc-500`}>{timeAgo(l.created_at)}</td>
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
        <Pagination page={p} total={list[0]?.total ?? 0} pageSize={PAGE_SIZE} params={{ q, status }} />
      </Card>
    </>
  );
}
