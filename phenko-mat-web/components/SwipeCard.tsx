"use client";

import Link from "next/link";
import { useRef, useState, type PointerEvent } from "react";
import type { Category, FeedItem } from "@/lib/dto";
import { CONDITION_LABEL, formatDistance, formatPrice, timeAgo } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import { ChevronDownIcon, InfoIcon, PinIcon } from "./icons";
import { trackDetails } from "@/lib/client/views";
import { PhotoViewer } from "./PhotoViewer";
import { Avatar, CategoryPill, Photo } from "./ui";

export type SwipeDir = "left" | "right";

const THRESHOLD = 110;
const TAP_SLOP = 6;
/** A quick flick commits even if it's short (same as the app). px per second. */
const FLICK_VELOCITY = 900;
const FLICK_MIN_DISTANCE = 30;

interface Props {
  item: FeedItem;
  categories: Map<string, Pick<Category, "id" | "name" | "emoji">>;
  isTop: boolean;
  depth: number;
  exitDir: SwipeDir | null;
  onSwipe: (dir: SwipeDir) => void;
  /** Owner's preview: looks and taps exactly like the feed, but can't be swiped away. */
  preview?: boolean;
  /** Shows "Report this listing" in the details panel. */
  onReport?: () => void;
}

export function SwipeCard({ item, categories, isTop, depth, exitDir, onSwipe, preview, onReport }: Props) {
  const now = useNow();
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  /** Recent pointer positions, to measure flick speed on release. */
  const samples = useRef<{ x: number; t: number }[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    // While the details panel is open the card holds still (no drag, no photo flip), like the app.
    if (!isTop || exitDir || showInfo) return;
    start.current = { x: e.clientX, y: e.clientY };
    samples.current = [{ x: e.clientX, t: e.timeStamp }];
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!start.current || preview) return;
    samples.current = [...samples.current.filter((p) => e.timeStamp - p.t < 100), { x: e.clientX, t: e.timeStamp }];
    setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, active: true });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    start.current = null;

    if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) {
      // Tap: left/right half flips photos, like Bumble.
      const rect = cardRef.current?.getBoundingClientRect();
      if (rect && item.photos.length > 1) {
        const next = e.clientX - rect.left < rect.width / 2 ? photoIndex - 1 : photoIndex + 1;
        setPhotoIndex(Math.max(0, Math.min(item.photos.length - 1, next)));
      }
      setDrag({ x: 0, y: 0, active: false });
      return;
    }
    const first = samples.current.find((p) => e.timeStamp - p.t < 100);
    const velocity = first && e.timeStamp > first.t ? ((e.clientX - first.x) / (e.timeStamp - first.t)) * 1000 : 0;
    const flick = Math.abs(velocity) > FLICK_VELOCITY && Math.abs(dx) > FLICK_MIN_DISTANCE;
    if (!preview && (Math.abs(dx) > THRESHOLD || flick)) {
      setDrag({ x: dx, y: dy, active: false });
      onSwipe((flick ? velocity : dx) > 0 ? "right" : "left");
    } else {
      setDrag({ x: 0, y: 0, active: false });
    }
  }

  const x = exitDir ? (exitDir === "right" ? 1 : -1) * 700 : drag.x;
  const y = exitDir ? drag.y + 40 : drag.y;
  const transform = isTop
    ? `translate3d(${x}px, ${y}px, 0) rotate(${x / 16}deg)`
    : `translate3d(0, ${depth * 10}px, 0) scale(${1 - depth * 0.04})`;
  const wantOpacity = Math.max(0, Math.min(1, (exitDir === "right" ? THRESHOLD : drag.x) / THRESHOLD));
  const passOpacity = Math.max(0, Math.min(1, (exitDir === "left" ? THRESHOLD : -drag.x) / THRESHOLD));

  return (
    <div
      ref={cardRef}
      className="absolute inset-0 touch-none select-none"
      style={{
        transform,
        transition: drag.active ? "none" : "transform 320ms cubic-bezier(0.2, 0.8, 0.3, 1)",
        zIndex: 10 - depth,
        cursor: isTop && !preview ? (drag.active ? "grabbing" : "grab") : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null;
        setDrag({ x: 0, y: 0, active: false });
      }}
      aria-hidden={!isTop}
    >
      <article className="relative h-full w-full overflow-hidden rounded-[28px] bg-ink shadow-[0_18px_40px_-12px_rgba(29,29,29,0.45)]">
        <Photo src={item.photos[photoIndex]} alt={item.title} priority={isTop} />

        {item.photos.length > 1 && (
          <div className="absolute inset-x-3 top-3 flex gap-1.5">
            {item.photos.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i === photoIndex ? "bg-white" : "bg-white/40"}`} />
            ))}
          </div>
        )}

        {/* Swipe stamps */}
        <span
          className="pointer-events-none absolute left-6 top-10 -rotate-12 rounded-xl border-4 border-honey px-3 py-1 text-3xl font-black tracking-wide text-honey"
          style={{ opacity: wantOpacity }}
        >
          WANT IT
        </span>
        <span
          className="pointer-events-none absolute right-6 top-10 rotate-12 rounded-xl border-4 border-white px-3 py-1 text-3xl font-black tracking-wide text-white"
          style={{ opacity: passOpacity }}
        >
          PASS
        </span>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-extrabold ${item.priceInr === 0 ? "bg-honey text-ink" : "bg-white text-ink"}`}
            >
              {formatPrice(item.priceInr)}
            </span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              {CONDITION_LABEL[item.condition]}
            </span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[1.65rem] leading-tight font-extrabold [text-wrap:balance]">{item.title}</h2>
              {(item.distanceKm !== null || item.area) && (
                <p className="mt-1 flex items-center gap-1 text-sm text-white/85">
                  <PinIcon size={15} />
                  {[formatDistance(item.distanceKm), item.area].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            {isTop && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setShowInfo(true);
                  if (!preview) trackDetails(item.id);
                }}
                className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/25 backdrop-blur-md transition hover:bg-white/40"
                aria-label="More about this item"
              >
                <InfoIcon size={22} />
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.categoryIds.map((id) => {
              const c = categories.get(id);
              return c ? <CategoryPill key={id} category={c} tone="glass" /> : null;
            })}
          </div>
        </div>

        {showInfo && (
          <div
            className="animate-rise absolute inset-x-0 bottom-0 max-h-[78%] overflow-y-auto rounded-t-[28px] bg-white p-6 text-ink"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-cream"
              aria-label="Close details"
            >
              <ChevronDownIcon size={20} />
            </button>
            <h3 className="pr-10 text-xl font-extrabold">{item.title}</h3>
            <p className="mt-1 text-sm text-ink-soft">
              {formatPrice(item.priceInr)} · {CONDITION_LABEL[item.condition]} · listed {timeAgo(item.createdAt, now)}
            </p>
            {item.description && <p className="mt-4 leading-relaxed whitespace-pre-line">{item.description}</p>}
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {item.photos.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setViewing(i)}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl"
                  aria-label={`View photo ${i + 1} full screen`}
                >
                  <Photo src={src} alt="" sizes="64px" />
                </button>
              ))}
            </div>
            <Link
              href={`/u/${item.owner.id}`}
              className="mt-4 flex items-center gap-3 rounded-2xl bg-paper p-3 transition hover:bg-cream"
            >
              <Avatar user={item.owner} size={44} />
              <div className="min-w-0">
                <p className="truncate font-bold">{item.owner.name}</p>
                <p className="text-sm text-ink-soft">
                  {[item.area, formatDistance(item.distanceKm)].filter(Boolean).join(" · ") || "View profile"}
                </p>
              </div>
            </Link>
            <p className="mt-4 text-xs text-ink-soft">
              Exact pickup spot is shared in chat, only after you both connect.
            </p>
            {onReport && (
              <button onClick={onReport} className="mt-3 text-xs font-semibold text-ink-soft underline hover:text-ink">
                Report this listing
              </button>
            )}
          </div>
        )}
      </article>
      {viewing !== null && <PhotoViewer photos={item.photos} start={viewing} alt={item.title} onClose={() => setViewing(null)} />}
    </div>
  );
}
