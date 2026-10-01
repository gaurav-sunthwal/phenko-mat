"use client";

import Image from "next/image";
import { useEffect, type ReactNode } from "react";
import { initials } from "@/lib/format";
import type { Category } from "@/lib/dto";
import { XIcon } from "./icons";

const HEART =
  "M0 70C-40 40-100 5-100-40C-100-75-72-100-45-100C-22-100-8-88 0-72C8-88 22-100 45-100C72-100 100-75 100-40C100 5 40 40 0 70Z";

/** The brand mark: an open box with a heart rising out of it. Same 1024 grid as the app icon and favicon. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
      <rect width="1024" height="1024" rx="230" fill="var(--color-honey)" />
      {/* Glyph scaled up a touch inside the tile so it stays legible at header sizes. */}
      <g transform="translate(512 512) scale(1.12) translate(-512 -512)" fill="var(--color-ink)" stroke="var(--color-ink)" strokeLinejoin="round">
        <path d="M318 560H706V770H318Z" strokeWidth="70" />
        <path d="M318 479L474 479L404 399L232 419Z" strokeWidth="44" />
        <path d="M706 479L550 479L620 399L792 419Z" strokeWidth="44" />
        <path d={HEART} stroke="none" transform="translate(512 315) rotate(-8) scale(1.2)" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <LogoMark />
      <span className="text-[1.35rem] leading-none">phenko mat</span>
    </span>
  );
}

const AVATAR_TINTS = ["bg-honey", "bg-[#FFB5A7]", "bg-[#B8E0D2]", "bg-[#CDB4DB]", "bg-[#A2D2FF]", "bg-[#FFD6A5]"];

export function Avatar({
  user,
  size = 40,
  ring = false,
}: {
  user?: { name: string; avatarUrl: string | null } | null;
  size?: number;
  ring?: boolean;
}) {
  const name = user?.name ?? "?";
  const tint = AVATAR_TINTS[[...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % AVATAR_TINTS.length];
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-ink ${tint} ${ring ? "ring-4 ring-white" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {user?.avatarUrl ? (
        <Photo src={user.avatarUrl} alt={name} sizes={`${size}px`} />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Fills its (relative) parent. Handles both remote demo photos and uploaded data URLs. */
export function Photo({
  src,
  alt,
  sizes = "480px",
  priority,
  className = "",
}: {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  // "" = no photo (a removed listing's photos are deleted from storage): plain placeholder.
  if (!src) return <span role="img" aria-label={alt} className={`absolute inset-0 bg-line ${className}`} />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      // Local previews (not uploaded yet) can't go through the image optimizer.
      unoptimized={src.startsWith("data:") || src.startsWith("blob:")}
      draggable={false}
      className={`object-cover select-none ${className}`}
    />
  );
}

export function CategoryPill({
  category,
  tone = "light",
}: {
  category: Pick<Category, "id" | "name" | "emoji">;
  tone?: "light" | "glass";
}) {
  const styles =
    tone === "glass"
      ? "bg-white/20 text-white backdrop-blur-md"
      : category.id === "premium"
        ? "bg-ink text-honey"
        : "bg-cream text-ink";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>
      <span aria-hidden="true">{category.emoji}</span>
      {category.name}
    </span>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="animate-fade absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="animate-rise relative max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-white p-6 pb-8 shadow-2xl sm:rounded-[28px]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-cream" aria-label="Close">
            <XIcon size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 text-center">
      <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-honey text-5xl">{emoji}</div>
      <h2 className="mb-2 text-2xl font-extrabold">{title}</h2>
      <p className="mb-6 max-w-xs text-ink-soft">{body}</p>
      {action}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-16" role="status" aria-label={label}>
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-honey border-t-transparent" />
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-4 rounded-2xl bg-[#FFE4E0] p-4 text-sm text-[#8A1C0B]" role="alert">
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-2 font-bold underline">
          Try again
        </button>
      )}
    </div>
  );
}
