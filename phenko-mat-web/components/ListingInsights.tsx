"use client";

import { ErrorNote, Spinner } from "./ui";
import { useItemStats } from "@/lib/client/hooks";
import type { ItemStats } from "@/lib/dto";

const REASON_LABEL: Record<keyof ItemStats["reports"]["byReason"], string> = {
  spam: "Spam",
  scam: "Scam",
  prohibited: "Not allowed",
  offensive: "Offensive",
  other: "Other",
};

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");

/** The owner's numbers for one listing (same as the app): who saw it, how they swiped, chats and reports. */
export function ListingInsights({ id }: { id: string }) {
  const { data: s, error, mutate, isValidating } = useItemStats(id);

  if (error) return <ErrorNote message={error.message} onRetry={() => mutate()} />;
  if (!s) return <Spinner />;

  const reasons = (Object.entries(s.reports.byReason) as [keyof typeof REASON_LABEL, number][]).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Tile emoji="👀" value={s.views} label={s.views === 1 ? "person saw it" : "people saw it"} wide />
        <Tile emoji="ⓘ" value={s.detailViews} label="opened details" note={percent(s.detailViews, s.views)} />
        <Tile emoji="💛" value={s.wanted} label="swiped right" note={percent(s.wanted, s.views)} honey />
        <Tile emoji="👋" value={s.passed} label="passed" note={percent(s.passed, s.views)} />
        <Tile emoji="💬" value={s.chats} label={s.chats === 1 ? "chat" : "chats"} />
      </div>

      <section className={`rounded-[22px] p-4 ${s.reports.total > 0 ? "bg-[#FFE4E0]" : "bg-white"}`}>
        <p className="font-extrabold">
          {s.reports.total === 0 ? "No reports 🎉" : `${s.reports.total} ${s.reports.total === 1 ? "report" : "reports"}`}
        </p>
        {s.reports.total === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">Nobody has flagged this listing.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-soft">Reporters stay anonymous. Clear photos and an honest description help.</p>
            <ul className="mt-3 space-y-1.5">
              {reasons.map(([reason, n]) => (
                <li key={reason} className="flex justify-between text-sm">
                  <span>{REASON_LABEL[reason] ?? reason}</span>
                  <strong>{n}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <p className="text-center text-xs text-ink-soft">
        Each person is counted once. Swipe percentages are out of everyone who saw it.{" "}
        <button onClick={() => mutate()} disabled={isValidating} className="font-semibold underline disabled:opacity-60">
          {isValidating ? "Refreshing…" : "Refresh"}
        </button>
      </p>
    </div>
  );
}

function Tile({ emoji, value, label, note, wide, honey }: { emoji: string; value: number; label: string; note?: string; wide?: boolean; honey?: boolean }) {
  return (
    <div className={`rounded-[22px] p-4 ${wide ? "col-span-2" : ""} ${honey ? "bg-honey" : "bg-white"}`}>
      <div className="flex items-start justify-between">
        <span className="text-2xl" aria-hidden="true">
          {emoji}
        </span>
        {note && <span className="text-sm font-bold text-ink-soft">{note}</span>}
      </div>
      <p className="mt-2 text-3xl font-black">{value.toLocaleString("en-IN")}</p>
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  );
}
