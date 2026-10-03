"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { ApiRequestError, api, fetcher } from "@/lib/client/api";
import { useCategories, useFeed, useMe } from "@/lib/client/hooks";
import { useUi, type FeedScope } from "@/lib/client/stores/ui";
import { trackSeen } from "@/lib/client/views";
import type { ReportTarget } from "@/lib/client/safety";
import type { FeedItem, SwipeResult, SwipeSummary } from "@/lib/dto";
import { HeartIcon, PinIcon, RefreshIcon, UndoIcon, XIcon } from "./icons";
import { LocationForm } from "./LocationSetup";
import { ReportSheet } from "./ReportSheet";
import { SwipeCard, type SwipeDir } from "./SwipeCard";
import { EmptyState, ErrorNote, Sheet } from "./ui";

const EXIT_MS = 260;
const REFILL_AT = 3;
const PREFETCH_CARDS = 6;
/** How many passes "Undo" can walk back through. */
const UNDO_DEPTH = 10;
/** next/image's default deviceSizes. */
const NEXT_IMAGE_WIDTHS = [640, 750, 828, 1080, 1200, 1920, 2048, 3840];
/** How far (px) a horizontal swipe or drag must go to flip Nearby ⇄ Everywhere. */
const SCOPE_SWIPE_DISTANCE = 60;

/** Used by the Feed, each category deck, and search results (`query`). */
export function SwipeDeck({ categoryId, query }: { categoryId?: string; query?: string }) {
  const { data: me } = useMe();
  // Default: nearby if we know where the user is, otherwise everything.
  const chosenScope = useUi((s) => s.feedScope);
  const setChosenScope = useUi((s) => s.setFeedScope);
  const scope: FeedScope | null = chosenScope ?? (me ? (me.location ? "nearby" : "all") : null);

  const { data, error, isLoading, mutate } = useFeed(categoryId, scope, query);
  const { data: categoryList } = useCategories();
  const { mutate: globalMutate } = useSWRConfig();
  const swiped = useUi((s) => s.swiped);
  const markSwiped = useUi((s) => s.markSwiped);
  const unmarkSwiped = useUi((s) => s.unmarkSwiped);
  const clearSwiped = useUi((s) => s.clearSwiped);
  const showMatch = useUi((s) => s.showMatch);
  const settleMatch = useUi((s) => s.settleMatch);
  const [exit, setExit] = useState<{ id: string; dir: SwipeDir } | null>(null);
  const [swipeError, setSwipeError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const refilling = useRef(false);
  const [resetting, setResetting] = useState(false);

  const categories = useMemo(() => new Map((categoryList ?? []).map((c) => [c.id, c])), [categoryList]);
  // Passes that can be undone (newest last), and cards brought back to the top of the deck.
  const [passed, setPassed] = useState<FeedItem[]>([]);
  const [restored, setRestored] = useState<FeedItem[]>([]);
  // In-flight swipe requests, so an undo never races ahead of the pass it's undoing.
  const pendingSwipes = useRef(new Map<string, Promise<unknown>>());

  const deck = useMemo(() => {
    const back = new Set(restored.map((i) => i.id));
    return [...restored, ...(data ?? []).filter((i) => !back.has(i.id))].filter((i) => !swiped[i.id]);
  }, [data, restored, swiped]);
  const top = deck[0];

  // Only when "Everywhere" runs dry: why it's empty, so we never offer "show passed items" with none to show.
  const summaryKey = (() => {
    if (top || scope !== "all" || query || !data) return null;
    const qs = new URLSearchParams();
    if (categoryId) qs.set("category", categoryId);
    return `/api/swipes${qs.size ? `?${qs}` : ""}`;
  })();
  const { data: summary, mutate: refreshSummary } = useSWR<SwipeSummary>(summaryKey, fetcher, {
    revalidateOnFocus: false,
  });

  // The card on top counts as "seen" for the owner's Insights.
  const topId = top?.id;
  useEffect(() => {
    if (topId) trackSeen(topId);
  }, [topId]);

  // Warm the browser cache with the next few cards' cover photos so they appear instantly (like the app).
  // Requests the same optimizer URL next/image picks for a card (sizes="480px" at this screen's density).
  useEffect(() => {
    const want = 480 * (window.devicePixelRatio || 1);
    const width = NEXT_IMAGE_WIDTHS.find((w) => w >= want) ?? NEXT_IMAGE_WIDTHS.at(-1)!;
    deck.slice(1, PREFETCH_CARDS).forEach((i) => {
      const src = i.photos[0];
      if (!src) return;
      const img = new window.Image();
      img.src = `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
    });
  }, [deck]);

  const fling = useCallback(
    (dir: SwipeDir) => {
      if (!top || exit) return;
      setExit({ id: top.id, dir });
      const itemId = top.id;
      window.setTimeout(() => {
        markSwiped(itemId);
        setExit(null);
      }, EXIT_MS);

      if (dir === "left") setPassed((p) => [...p.filter((i) => i.id !== top.id), top].slice(-UNDO_DEPTH));
      if (dir === "right") {
        // Every right swipe on an active item connects, so celebrate now instead of after the round trip;
        // the request only has to supply the chat id (or say the item is gone) before "Send a message" needs it.
        showMatch({
          itemId,
          item: { title: top.title, photo: top.photos[0] ?? "", priceInr: top.priceInr },
          other: top.owner,
          connectionId: null,
          error: null,
        });
      }

      const request = api<SwipeResult>("POST", "/api/swipes", { itemId, direction: dir });
      pendingSwipes.current.set(itemId, request);
      void request.finally(() => pendingSwipes.current.delete(itemId)).catch(() => {});
      request
        .then((res) => {
          setSwipeError(null);
          if (res.connection) {
            settleMatch(itemId, { connectionId: res.connection.id });
            // Seed the chat header so "Send a message" opens a fully rendered chat.
            globalMutate(`/api/connections/${res.connection.id}`, res.connection, { revalidate: false });
            globalMutate("/api/connections");
            globalMutate("/api/me/likes");
          }
        })
        .catch((e: unknown) => {
          // e.g. 410 when someone else got it first — it's already gone from the deck, just say why.
          const message = e instanceof ApiRequestError ? e.message : "Couldn't save that swipe.";
          setSwipeError(message);
          if (dir === "right") settleMatch(itemId, { error: message });
        });
    },
    [top, exit, globalMutate, markSwiped, settleMatch, showMatch],
  );

  /** Brings the last passed card back on top; the server forgets that pass (same as the app). */
  const undo = useCallback(() => {
    const item = passed.at(-1);
    if (!item || exit) return;
    setPassed((p) => p.slice(0, -1));
    setRestored((r) => [item, ...r.filter((i) => i.id !== item.id)]);
    unmarkSwiped(item.id);
    setSwipeError(null);
    const pending = pendingSwipes.current.get(item.id) ?? Promise.resolve();
    void pending
      .catch(() => {})
      .then(() => api("DELETE", `/api/swipes/${item.id}`))
      .catch((e: unknown) => setSwipeError(e instanceof ApiRequestError ? e.message : "Couldn't bring that one back."));
  }, [passed, exit, unmarkSwiped]);

  // Keyboard: ← pass, → want, ⌘Z / Ctrl+Z undo the last pass.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") fling("left");
      if (e.key === "ArrowRight") fling("right");
      if (e.key.toLowerCase() === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fling, undo]);

  // Top up the deck before it runs dry.
  useEffect(() => {
    if (!data || data.length === 0 || deck.length > REFILL_AT || refilling.current) return;
    refilling.current = true;
    mutate().finally(() => {
      refilling.current = false;
    });
  }, [data, deck.length, mutate]);

  /**
   * Swipe left → Everywhere, swipe right → Nearby (touch or mouse drag). Works on the pill always,
   * and on the whole feed once there are no cards left (cards own left/right for pass/like).
   * Category decks keep it on the pill only, like the app.
   */
  const scopeSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const scopeSwipe = {
    onPointerDown: (e: PointerEvent) => {
      scopeSwipeStart.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: PointerEvent) => {
      const start = scopeSwipeStart.current;
      scopeSwipeStart.current = null;
      if (!start || !scope) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) < SCOPE_SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const next: FeedScope = dx < 0 ? "all" : "nearby";
      // A stray swipe shouldn't pop open the location sheet; tapping the pill still does.
      if (next !== scope && !(next === "nearby" && !me?.location)) setChosenScope(next);
    },
    onPointerCancel: () => {
      scopeSwipeStart.current = null;
    },
  };
  const screenSwipe = !top && !categoryId && !query;

  function pickScope(next: FeedScope) {
    if (next === "nearby" && !me?.location) {
      setLocating(true);
      return;
    }
    setChosenScope(next);
  }

  async function resetPasses() {
    setResetting(true);
    try {
      const qs = categoryId ? `?category=${encodeURIComponent(categoryId)}` : "";
      await api("DELETE", `/api/swipes${qs}`);
      clearSwiped();
      // Passed items come back in every deck, not just this one.
      await globalMutate((key) => typeof key === "string" && key.startsWith("/api/feed"));
      void refreshSummary();
    } catch (e) {
      setSwipeError(e instanceof ApiRequestError ? e.message : "Couldn't bring passed items back. Try again.");
    } finally {
      setResetting(false);
    }
  }

  let body;
  if (error && !(error instanceof ApiRequestError && error.code === "LOCATION_REQUIRED")) {
    body = <ErrorNote message={error.message} onRetry={() => mutate()} />;
  } else if (!scope || (isLoading && !data)) {
    body = <DeckSkeleton />;
  } else if (!top && query) {
    // Search already includes items passed on before, so there's nothing to "show again".
    body =
      scope === "nearby" ? (
        <EmptyState
          emoji="🔍"
          title={`No “${query}” nearby`}
          body={`Nothing matching within ${me?.radiusKm ?? 10} km right now. It might be listed a little further away.`}
          action={
            <button onClick={() => setChosenScope("all")} className="rounded-full bg-ink px-6 py-3 font-bold text-white">
              Search everywhere
            </button>
          }
        />
      ) : (
        <EmptyState
          emoji="🔍"
          title={`No “${query}” yet`}
          body="Nobody has listed one yet. Try another word, or check back soon."
        />
      );
  } else if (!top) {
    body =
      scope === "nearby" ? (
        <EmptyState
          emoji="📍"
          title="Nothing new nearby"
          body={`No more items within ${me?.radiusKm ?? 10} km right now. You can still browse everything on Phenko Mat.`}
          action={
            <div className="flex flex-col items-center gap-3">
              <button onClick={() => setChosenScope("all")} className="rounded-full bg-ink px-6 py-3 font-bold text-white">
                See all items
              </button>
              <button onClick={() => setLocating(true)} className="text-sm font-semibold underline">
                Widen search radius
              </button>
            </div>
          }
        />
      ) : (
        <ExhaustedDeck
          summary={summary}
          inCategory={Boolean(categoryId)}
          resetting={resetting}
          onReset={resetPasses}
          error={swipeError}
        />
      );
  } else {
    body = (
      <div className="flex flex-1 flex-col px-4 pb-4">
        {swipeError && (
          <p className="mb-2 rounded-xl bg-cream px-3 py-2 text-center text-sm font-medium" role="status">
            {swipeError}
          </p>
        )}
        <div className="relative min-h-[420px] flex-1 md:min-h-[560px]">
          {deck
            .slice(0, 3)
            .map((item, depth) => (
              <SwipeCard
                key={item.id}
                item={item}
                categories={categories}
                isTop={depth === 0}
                depth={depth}
                exitDir={exit?.id === item.id ? exit.dir : null}
                onSwipe={fling}
                onReport={depth === 0 ? () => setReporting({ kind: "item", id: item.id, title: item.title }) : undefined}
              />
            ))
            .reverse()}
        </div>

        <div className="mt-5 flex items-center justify-center gap-6">
          {passed.length ? (
            <button
              onClick={undo}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-honey-deep shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)] transition hover:scale-105 active:scale-95"
              aria-label="Undo last pass"
              title="Undo last pass (⌘Z / Ctrl+Z)"
            >
              <UndoIcon size={22} strokeWidth={2.4} />
            </button>
          ) : (
            <span className="h-12 w-12" aria-hidden="true" />
          )}
          <button
            onClick={() => fling("left")}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-ink-soft shadow-[0_8px_24px_-8px_rgba(0,0,0,0.25)] transition hover:scale-105 active:scale-95"
            aria-label="Pass"
          >
            <XIcon size={30} strokeWidth={2.6} />
          </button>
          <button
            onClick={() => fling("right")}
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-honey text-ink shadow-[0_10px_28px_-8px_rgba(245,180,0,0.8)] transition hover:scale-105 active:scale-95"
            aria-label="I want this"
          >
            <HeartIcon size={34} filled />
          </button>
          {/* Balances the undo button so Pass / Want stay centred. */}
          <span className="h-12 w-12" aria-hidden="true" />
        </div>
        <p className="mt-3 text-center text-xs text-ink-soft">
          Swipe right to connect with the owner · ← → keys work too, ⌘Z undoes a pass
        </p>
      </div>
    );
  }

  // Passed the last card by mistake: offer it back under the "all done" message.
  const failed = error && !(error instanceof ApiRequestError && error.code === "LOCATION_REQUIRED");
  const loading = !scope || (isLoading && !data);
  if (!failed && !loading && !top && passed.length) {
    body = (
      <div className="flex flex-1 flex-col">
        {body}
        <button onClick={undo} className="mx-auto mb-6 flex items-center gap-1.5 text-sm font-semibold underline">
          <UndoIcon size={16} /> Bring back the last one
        </button>
      </div>
    );
  }

  return (
    // touch-pan-y: the browser keeps vertical scrolling, horizontal drags come to us.
    // md and up: a centred, taller deck column instead of the full (much wider) content area.
    <div
      className={`flex flex-1 flex-col md:mx-auto md:w-full md:max-w-[480px] md:pb-6 ${screenSwipe ? "touch-pan-y" : ""}`}
      {...(screenSwipe ? scopeSwipe : {})}
    >
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div
              className="grid touch-pan-y grid-cols-2 gap-1 rounded-full bg-white p-1 shadow-sm"
              role="tablist"
              aria-label="Show items"
              {...(screenSwipe ? {} : scopeSwipe)}
            >
              {(
                [
                  ["nearby", "📍 Nearby"],
                  ["all", "🌏 Everywhere"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  role="tab"
                  aria-selected={scope === value}
                  onClick={() => pickScope(value)}
                  className={`rounded-full py-2 text-sm font-bold transition ${
                    scope === value ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {me && !me.location && (
          <button
            onClick={() => setLocating(true)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-cream px-3 py-2 text-sm font-semibold"
          >
            <PinIcon size={15} /> Set your location to see what&apos;s close to you
          </button>
        )}
      </div>

      {body}

      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
      <Sheet open={locating} onClose={() => setLocating(false)} title="Your location">
        <LocationForm
          me={me}
          onDone={() => {
            setLocating(false);
            setChosenScope("nearby");
          }}
        />
      </Sheet>
    </div>
  );
}

/** Card-shaped placeholder so the layout doesn't jump while the first cards load. */
function DeckSkeleton() {
  return (
    <div className="flex flex-1 flex-col px-4 pb-4" role="status" aria-label="Finding things">
      <div className="relative min-h-[420px] flex-1 animate-pulse overflow-hidden rounded-[28px] bg-line">
        <div className="absolute inset-x-5 bottom-6 space-y-3">
          <div className="h-6 w-20 rounded-full bg-white/70" />
          <div className="h-7 w-3/4 rounded-lg bg-white/70" />
          <div className="h-4 w-1/2 rounded bg-white/60" />
        </div>
      </div>
      <div className="mt-5 flex items-center justify-center gap-8">
        <div className="h-16 w-16 rounded-full bg-white" />
        <div className="h-[76px] w-[76px] rounded-full bg-cream" />
      </div>
      <div className="mt-3 h-4" />
    </div>
  );
}

/** "Everywhere" has nothing left: say why, and only offer what will actually bring cards back. */
function ExhaustedDeck({
  summary,
  inCategory,
  resetting,
  onReset,
  error,
}: {
  summary: SwipeSummary | undefined;
  inCategory: boolean;
  resetting: boolean;
  onReset: () => void;
  error: string | null;
}) {
  const where = inCategory ? "in this category" : "right now";
  const errorNote = error && (
    <p className="mt-3 text-sm font-medium text-[#B42318]" role="alert">
      {error}
    </p>
  );

  if (summary && summary.passed > 0) {
    const n = summary.passed;
    return (
      <EmptyState
        emoji="🐝"
        title="You've seen it all"
        body={`You've swiped through everything ${where}. You passed on ${n} ${n === 1 ? "item" : "items"} — give ${n === 1 ? "it" : "them"} another look?`}
        action={
          <div className="flex flex-col items-center">
            <button
              onClick={onReset}
              disabled={resetting}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-bold text-white disabled:opacity-60"
            >
              <RefreshIcon size={18} /> {resetting ? "Loading…" : `Show ${n} passed ${n === 1 ? "item" : "items"} again`}
            </button>
            {errorNote}
          </div>
        }
      />
    );
  }

  if (summary && summary.wanted > 0) {
    return (
      <EmptyState
        emoji="💛"
        title="You've said yes to everything"
        body={`You swiped right on every listing ${where} — they're waiting in your chats. New things show up here as neighbours post them.`}
        action={
          <Link href="/chats" className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-bold text-white">
            Go to your chats
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
      emoji="🐝"
      title="You've seen it all"
      body="There's nothing new to swipe on right now. Check back soon — neighbours post new things every day."
      action={errorNote || undefined}
    />
  );
}
