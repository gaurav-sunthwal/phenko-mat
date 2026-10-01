import Link from "next/link";
import { Badge, Card, Empty, PageHeader, Pagination, td, th } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { PAGE_SIZE, auditLog } from "@/lib/queries";

export const metadata = { title: "Audit log · Phenko Mat Admin" };

const HREF: Record<string, (id: string) => string> = {
  listing: (id) => `/listings/${id}`,
  user: (id) => `/users/${id}`,
  category: () => "/categories",
  error: (id) => `/errors/${id}`,
};

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const { page = "1" } = (await searchParams) as { page?: string };
  const p = Math.max(1, Number(page) || 1);
  const list = await auditLog(p);

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every action taken in this panel, newest first." />
      <Card>
        {list.length === 0 ? (
          <Empty>No admin actions yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200">
              <tr>
                <th className={th}>When</th>
                <th className={th}>Admin</th>
                <th className={th}>Action</th>
                <th className={th}>Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {list.map((a) => (
                <tr key={a.id}>
                  <td className={`${td} whitespace-nowrap text-zinc-500`}>{formatDateTime(a.created_at)}</td>
                  <td className={td}>{a.admin_email}</td>
                  <td className={td}>
                    <Badge tone={a.action.includes("delete") || a.action.includes("remove") || a.action === "user.suspend" ? "red" : "zinc"}>{a.action}</Badge>
                  </td>
                  <td className={td}>
                    {a.action === "user.delete" ? (
                      <span>{a.summary}</span>
                    ) : (
                      <Link href={HREF[a.target_type]?.(a.target_id) ?? "#"} className="hover:underline">
                        {a.summary ?? a.target_id}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={p} total={list[0]?.total ?? 0} pageSize={PAGE_SIZE} params={{}} />
      </Card>
    </>
  );
}
