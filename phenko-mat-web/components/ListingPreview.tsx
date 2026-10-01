"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { ArrowLeftIcon, HeartIcon, PencilIcon } from "./icons";
import { ListingInsights } from "./ListingInsights";
import { ReportSheet } from "./ReportSheet";
import { SwipeCard } from "./SwipeCard";
import { Avatar, ErrorNote, Spinner } from "./ui";
import { ApiRequestError, api } from "@/lib/client/api";
import { useCategories, useConnections, useItem, useMe } from "@/lib/client/hooks";
import type { ReportTarget } from "@/lib/client/safety";
import { trackSeen } from "@/lib/client/views";
import { useUi } from "@/lib/client/stores/ui";
import type { SwipeResult } from "@/lib/dto";

const noop = () => {};

/**
 * One listing as the same card people swipe on. For the owner: a preview with "Edit listing". For
 * anyone else (opened from a chat or someone's profile): who's giving it, "I want this" / "Open chat",
 * and Report.
 */
export function ListingPreview({ id }: { id: string }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data, error, mutate: refresh } = useItem(id);
  const { data: me } = useMe();
  const { data: chats } = useConnections();
  const { data: categoryList } = useCategories();
  const showMatch = useUi((s) => s.showMatch);
  const settleMatch = useUi((s) => s.settleMatch);
  const markSwiped = useUi((s) => s.markSwiped);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const [wanting, setWanting] = useState(false);
  const [tab, setTab] = useState<"preview" | "insights">("preview");
  const categories = useMemo(() => new Map((categoryList ?? []).map((c) => [c.id, c])), [categoryList]);

  const isOwner = Boolean(me && data && data.owner.id === me.id);
  // Distance depends on who's looking; from the owner's own spot it would always read "100 m away".
  const item = useMemo(() => data && (isOwner ? { ...data, distanceKm: null } : data), [data, isOwner]);
  const chat = chats?.find((c) => c.role === "taker" && c.item.id === id);

  // Someone else opening the listing counts as a view for the owner's Insights.
  const viewerIsOther = Boolean(me && data && data.owner.id !== me.id);
  useEffect(() => {
    if (viewerIsOther) trackSeen(id);
  }, [viewerIsOther, id]);

  async function want() {
    if (!data) return;
    setWanting(true);
    markSwiped(data.id);
    showMatch({
      itemId: data.id,
      item: { title: data.title, photo: data.photos[0] ?? "", priceInr: data.priceInr },
      other: data.owner,
      connectionId: null,
      error: null,
    });
    try {
      const res = await api<SwipeResult>("POST", "/api/swipes", { itemId: data.id, direction: "right" });
      if (res.connection) {
        settleMatch(data.id, { connectionId: res.connection.id });
        mutate(`/api/connections/${res.connection.id}`, res.connection, { revalidate: false });
        mutate("/api/connections");
        mutate("/api/me/likes");
      }
    } catch (e) {
      settleMatch(data.id, { error: e instanceof ApiRequestError ? e.message : "Couldn't connect. Try again." });
    } finally {
      setWanting(false);
    }
  }

  const backButton = isOwner ? (
    <Link
      href="/profile"
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
      aria-label="Back to profile"
    >
      <ArrowLeftIcon size={18} />
    </Link>
  ) : (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/feed"))}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm"
      aria-label="Back"
    >
      <ArrowLeftIcon size={18} />
    </button>
  );

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-3 pb-6 md:mx-auto md:w-full md:max-w-[480px] md:pt-8">
      <header className="flex items-center gap-3 pb-3">
        {backButton}
        <h1 className="text-xl font-extrabold md:text-3xl md:font-black">{isOwner ? "Preview" : "Listing"}</h1>
      </header>

      {error ? (
        <ErrorNote message={error.message} onRetry={() => refresh()} />
      ) : !item || !me ? (
        <Spinner />
      ) : (
        <>
          {isOwner && (
            <div
              className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-white p-1 shadow-sm"
              role="tablist"
              aria-label="Listing view"
            >
              {(["preview", "insights"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded-full py-2 text-sm font-bold transition ${tab === t ? "bg-ink text-white" : "text-ink-soft hover:text-ink"}`}
                >
                  {t === "preview" ? "Preview" : "Insights"}
                </button>
              ))}
            </div>
          )}
          {isOwner && tab === "insights" ? (
            <ListingInsights id={id} />
          ) : (
            <>
              {isOwner && (
                <p className="mb-3 px-2 text-center text-sm text-ink-soft">
                  {item.status === "active"
                    ? "This is how people nearby see your listing. Click the photo to flip through, or ⓘ for details."
                    : "Marked as given, so it's hidden from the feed. Relist it from your profile to show it again."}
                </p>
              )}
              <div className="relative min-h-[420px] flex-1 md:min-h-[560px]">
                <SwipeCard item={item} categories={categories} isTop depth={0} exitDir={null} onSwipe={noop} preview />
              </div>

              {isOwner ? (
                <Link
                  href={`/listing/${id}/edit`}
                  className="mt-4 flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-4 text-lg font-extrabold text-white transition hover:bg-black"
                >
                  <PencilIcon size={18} /> Edit listing
                </Link>
              ) : (
                <>
                  <Link
                    href={`/u/${item.owner.id}`}
                    className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-3 transition hover:bg-cream"
                  >
                    <Avatar user={item.owner} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{item.owner.name}</span>
                      <span className="block text-xs text-ink-soft">View profile and other listings</span>
                    </span>
                  </Link>
                  {chat ? (
                    <Link
                      href={`/chat/${chat.id}`}
                      className="mt-3 flex items-center justify-center rounded-full bg-ink px-6 py-4 text-lg font-extrabold text-white transition hover:bg-black"
                    >
                      Open chat
                    </Link>
                  ) : item.status === "active" ? (
                    <button
                      onClick={want}
                      disabled={wanting}
                      className="mt-3 flex items-center justify-center gap-2 rounded-full bg-honey px-6 py-4 text-lg font-extrabold text-ink transition hover:brightness-95 disabled:opacity-60"
                    >
                      <HeartIcon size={20} filled /> I want this
                    </button>
                  ) : (
                    <p className="mt-3 text-center text-sm font-semibold text-ink-soft">Someone already got this one.</p>
                  )}
                  <button
                    onClick={() => setReporting({ kind: "item", id: item.id, title: item.title })}
                    className="mx-auto mt-4 text-sm font-semibold text-ink-soft underline hover:text-ink"
                  >
                    Report this listing
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
    </div>
  );
}
