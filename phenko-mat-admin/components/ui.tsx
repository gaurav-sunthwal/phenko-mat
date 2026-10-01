import Link from "next/link";
import type { ReactNode } from "react";

/** Photo thumbnail. Plain <img>: admin pages show few images and shouldn't depend on image-domain config. */
export function Thumb({ src, alt, size = 48, round }: { src: string | null; alt: string; size?: number; round?: boolean }) {
  const cls = `${round ? "rounded-full" : "rounded-lg"} shrink-0 bg-zinc-200 object-cover`;
  if (!src) return <span className={`${cls} inline-block`} style={{ width: size, height: size }} aria-label={alt} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={size} height={size} className={cls} style={{ width: size, height: size }} loading="lazy" />;
}

const TONES = {
  zinc: "bg-zinc-100 text-zinc-700",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-800",
} as const;

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "active" ? "green" : status === "given" ? "blue" : "red";
  return <Badge tone={tone}>{status}</Badge>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 ${className}`}>{children}</section>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-zinc-500">{children}</p>;
}

/** Prev / next links that keep the other query params. */
export function Pagination({ page, total, pageSize, params }: { page: number; total: number; pageSize: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter((e): e is [string, string] => Boolean(e[1])));
    return `?${qs}`;
  };
  const btn = "rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ring-zinc-200";
  return (
    <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm text-zinc-500">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className={`${btn} bg-white hover:bg-zinc-50`}>Previous</Link> : null}
        {page < pages ? <Link href={href(page + 1)} className={`${btn} bg-white hover:bg-zinc-50`}>Next</Link> : null}
      </div>
    </div>
  );
}

export const th = "px-4 py-2.5 text-left text-xs font-semibold tracking-wide text-zinc-500 uppercase";
export const td = "px-4 py-3 align-middle";
