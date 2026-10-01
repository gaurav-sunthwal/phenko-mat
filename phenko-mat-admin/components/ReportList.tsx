import Link from "next/link";
import { Badge, Empty } from "./ui";
import { REASON_LABEL, formatDateTime } from "@/lib/format";
import type { ReportRow } from "@/lib/queries";

export function ReportList({ reports, showItem }: { reports: ReportRow[]; showItem?: boolean }) {
  if (!reports.length) return <Empty>No reports.</Empty>;
  return (
    <ul className="divide-y divide-zinc-100">
      {reports.map((r) => (
        <li key={r.id} className="px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="amber">{REASON_LABEL[r.reason] ?? r.reason}</Badge>
            {r.resolved_at ? (
              <Badge tone={r.resolution === "actioned" ? "green" : "zinc"}>{r.resolution}</Badge>
            ) : (
              <Badge tone="red">open</Badge>
            )}
            <span className="text-zinc-500">
              by{" "}
              <Link href={`/users/${r.reporter_id}`} className="font-medium text-zinc-700 hover:underline">
                {r.reporter_name}
              </Link>{" "}
              · {formatDateTime(r.created_at)}
            </span>
          </div>
          {showItem && r.item_id && (
            <p className="mt-1 text-zinc-600">
              Listing:{" "}
              <Link href={`/listings/${r.item_id}`} className="font-medium hover:underline">
                {r.item_title}
              </Link>
            </p>
          )}
          {!showItem || r.item_id ? null : <p className="mt-1 text-zinc-600">Reported as a person</p>}
          {r.details && <p className="mt-1.5 rounded-lg bg-zinc-50 px-3 py-2 text-zinc-700">“{r.details}”</p>}
          {r.resolved_by && <p className="mt-1 text-xs text-zinc-400">Resolved by {r.resolved_by}</p>}
        </li>
      ))}
    </ul>
  );
}
