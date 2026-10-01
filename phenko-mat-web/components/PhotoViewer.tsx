"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftIcon, XIcon } from "./icons";

/** Full-screen photos to check an item's condition: arrows / ← → / swipe to move, Esc to close. */
export function PhotoViewer({ photos, start, alt, onClose }: { photos: string[]; start: number; alt: string; onClose: () => void }) {
  const [index, setIndex] = useState(start);
  const [touchX, setTouchX] = useState<number | null>(null);
  // Zoom (the app pinch-zooms): double-click / double-tap toggles 2.5×, centred where you tapped;
  // with a mouse, the zoomed view follows the pointer so you can inspect every corner.
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const go = (delta: number) => {
    setZoom(null);
    setIndex((i) => Math.max(0, Math.min(photos.length - 1, i + delta)));
  };
  const originAt = (el: HTMLElement, clientX: number, clientY: number) => {
    const r = el.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
  };
  const toggleZoom = (el: HTMLElement, clientX: number, clientY: number) =>
    setZoom((z) => (z ? null : originAt(el, clientX, clientY)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") {
        setZoom(null);
        setIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "ArrowRight") {
        setZoom(null);
        setIndex((i) => Math.min(photos.length - 1, i + 1));
      }
      // Keep the deck behind from reacting to the same keys.
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, photos.length]);

  // Portal: the card behind uses CSS transforms, which would otherwise trap a `fixed` overlay inside it.
  return createPortal(
    <div
      className="animate-fade fixed inset-0 z-[80] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`${alt}, photo ${index + 1} of ${photos.length}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm font-semibold">
          {index + 1} / {photos.length}
          <span className="ml-3 font-normal text-white/60">Double-click to zoom</span>
        </span>
        <button onClick={onClose} className="rounded-full bg-white/15 p-2 hover:bg-white/25" aria-label="Close photos">
          <XIcon size={22} />
        </button>
      </div>
      <div
        className={`relative flex-1 overflow-hidden ${zoom ? "cursor-zoom-out" : "cursor-zoom-in"}`}
        onDoubleClick={(e) => toggleZoom(e.currentTarget, e.clientX, e.clientY)}
        onMouseMove={(e) => zoom && setZoom(originAt(e.currentTarget, e.clientX, e.clientY))}
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const t = e.changedTouches[0];
          // Double-tap toggles zoom; a horizontal swipe (when not zoomed) changes photo.
          if (Date.now() - lastTap.current < 300) {
            toggleZoom(e.currentTarget, t.clientX, t.clientY);
            lastTap.current = 0;
          } else {
            lastTap.current = Date.now();
            if (touchX !== null && !zoom) {
              const dx = t.clientX - touchX;
              if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            }
          }
          setTouchX(null);
        }}
      >
        <Image
          src={photos[index]}
          alt={alt}
          fill
          sizes="100vw"
          className="object-contain transition-transform duration-200"
          style={zoom ? { transform: "scale(2.5)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          priority
        />
        {index > 0 && (
          <button
            onClick={() => go(-1)}
            className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white hover:bg-white/25"
            aria-label="Previous photo"
          >
            <ArrowLeftIcon size={22} />
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            onClick={() => go(1)}
            className="absolute top-1/2 right-3 -translate-y-1/2 rotate-180 rounded-full bg-white/15 p-3 text-white hover:bg-white/25"
            aria-label="Next photo"
          >
            <ArrowLeftIcon size={22} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
