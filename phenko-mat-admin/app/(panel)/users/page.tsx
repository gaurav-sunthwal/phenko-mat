import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { Badge, Card, Empty, PageHeader, Pagination, Thumb, td, th } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { PAGE_SIZE, listUsers } from "@/lib/queries";

export const metadata = { title: "Users · Phenko Mat Admin" };

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const { q, filter = "all", page = "1" } = (await searchParams) as { q?: string; filter?: string; page?: string };
  const p = Math.max(1, Number(page) || 1);
  const list = await listUsers({ q: q?.trim() || undefined, filter, page: p });

  return (
    <>
      <PageHeader title="Users" subtitle="Search by name, email or user id.">
        <SearchBar
          q={q}
          placeholder="Search users…"
          filter={{
            name: "filter",
            value: filter,
            options: [
              { value: "all", label: "Everyone" },
              { value: "reported", label: "With open reports" },
              { value: "suspended", label: "Suspended" },
            ],
          }}
        />
      </PageHeader>
      <Card>
        {list.length === 0 ? (
          <Empty>No users match.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200">
              <tr>
                <th className={th}>User</th>
                <th className={th}>Area</th>
                <th className={th}>Listings</th>
                <th className={th}>Open reports</th>
                <th className={th}>Joined</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {list.map((u) => (
                <tr key={u.id}>
                  <td className={td}>
                    <Link href={`/users/${u.id}`} className="flex items-center gap-3">
                      <Thumb src={u.avatar_url} alt={u.name} size={36} round />
                      <span className="min-w-0">
                        <span className="block font-semibold hover:underline">{u.name}</span>
                        <span className="block truncate text-xs text-zinc-500">{u.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={`${td} max-w-48 truncate text-zinc-600`}>{u.area ?? "—"}</td>
                  <td className={td}>{u.listings}</td>
                  <td className={td}>{u.open_reports ? <Badge tone="red">{u.open_reports}</Badge> : <span className="text-zinc-400">0</span>}</td>
                  <td className={`${td} whitespace-nowrap text-zinc-500`}>{formatDate(u.created_at)}</td>
                  <td className={td}>{u.banned_at ? <Badge tone="red">suspended</Badge> : <Badge tone="green">active</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={p} total={list[0]?.total ?? 0} pageSize={PAGE_SIZE} params={{ q, filter }} />
      </Card>
    </>
  );
}
