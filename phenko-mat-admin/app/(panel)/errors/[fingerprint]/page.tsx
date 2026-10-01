import Link from "next/link";
import { notFound } from "next/navigation";
import { clearErrorGroup } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { Badge, Card, PageHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { errorEventsFor } from "@/lib/queries";

export const metadata = { title: "Error · Phenko Mat Admin" };

export default async function ErrorDetailPage({ params }: PageProps<"/errors/[fingerprint]">) {
  const { fingerprint } = await params;
  if (!/^[0-9a-f]{32}$/.test(fingerprint)) notFound();
  const events = await errorEventsFor(fingerprint);
  if (!events.length) notFound();
  const latest = events[0];

  return (
    <>
      <Link href="/errors" className="text-sm font-semibold text-zinc-500 hover:text-black">← Errors</Link>
      <PageHeader title={latest.message} subtitle={[latest.source, latest.route, latest.code].filter(Boolean).join(" · ")}>
        <ActionForm
          action={clearErrorGroup}
          fields={{ fingerprint }}
          label="Clear this error"
          pendingLabel="Clearing…"
          confirm="Delete all recorded occurrences of this error? Do this once it's fixed; new occurrences will show up again."
        />
      </PageHeader>
      <p className="mb-4 text-sm text-zinc-500">Latest {events.length} occurrences, newest first.</p>
      <div className="space-y-4">
        {events.map((e) => {
          let meta: Record<string, unknown> | null = null;
          try {
            meta = e.meta ? (JSON.parse(e.meta) as Record<string, unknown>) : null;
          } catch {
            meta = null;
          }
          return (
            <Card key={e.id} className="p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{formatDateTime(e.created_at)}</span>
                <Badge tone="red">{e.source}</Badge>
                {e.method && <Badge>{e.method}</Badge>}
                {e.status && <Badge>{e.status}</Badge>}
                {e.user_id ? (
                  <Link href={`/users/${e.user_id}`} className="text-zinc-600 hover:underline">
                    {e.user_name ?? "deleted user"}
                  </Link>
                ) : (
                  <span className="text-zinc-400">not signed in</span>
                )}
              </div>
              {meta && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(meta).map(([k, v]) => (
                    <Badge key={k}>
                      {k}: {String(v)}
                    </Badge>
                  ))}
                </div>
              )}
              {e.stack && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-zinc-500">Stack trace</summary>
                  <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100">{e.stack}</pre>
                </details>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
