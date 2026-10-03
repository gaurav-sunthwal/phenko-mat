import Image from "next/image";
import { HeartIcon, XIcon } from "./icons";

const unsplash = (id: string) => `https://images.unsplash.com/${id}?w=700&q=80&auto=format&fit=crop`;

const HERO_CARDS = [
  { id: "photo-1586023492125-27b2c045efd7", title: "Mustard armchair", meta: "₹2,500 · 1.2 km", rotate: "-rotate-6", pos: "left-0 top-10" },
  { id: "photo-1485965120184-e220f721d03e", title: "City bike", meta: "₹3,500 · 0.8 km", rotate: "rotate-6", pos: "right-0 top-4" },
  { id: "photo-1551028719-00167b16eac5", title: "Leather jacket", meta: "₹150 · 600 m", rotate: "rotate-0", pos: "left-1/2 -translate-x-1/2 top-0" },
];

/** The stacked swipe cards + pass/want buttons used on the landing page and the sign-in page. */
export function HeroCards({ className = "" }: { className?: string }) {
  return (
    <div className={`relative mx-auto h-[440px] w-full max-w-[400px] ${className}`} aria-hidden="true">
      {HERO_CARDS.map((c) => (
        <div
          key={c.id}
          className={`absolute h-[360px] w-[240px] overflow-hidden rounded-[28px] border-4 border-white bg-ink shadow-2xl ${c.rotate} ${c.pos}`}
        >
          <Image src={unsplash(c.id)} alt="" fill sizes="240px" className="object-cover" priority />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-16 text-white">
            <p className="text-lg font-extrabold">{c.title}</p>
            <p className="text-sm opacity-85">{c.meta}</p>
          </div>
        </div>
      ))}
      <div className="absolute inset-x-0 bottom-0 flex justify-center gap-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-ink-soft shadow-xl">
          <XIcon size={28} strokeWidth={2.6} />
        </span>
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-honey shadow-xl">
          <HeartIcon size={28} filled />
        </span>
      </div>
    </div>
  );
}
