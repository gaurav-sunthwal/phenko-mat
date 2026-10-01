import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeroCards } from "@/components/HeroCards";
import { Wordmark } from "@/components/ui";
import { LoginForm } from "./LoginForm";

// A sign-in form isn't a search result; keep it out of the index but let crawlers follow its links.
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };

const POINTS = [
  { emoji: "📍", text: "Swipe through things neighbours are giving away, sorted by distance." },
  { emoji: "💬", text: "Swipe right to chat with the owner and plan a pickup." },
  { emoji: "📦", text: "List what you don't need in under a minute. Most things go free." },
];

/**
 * Phones: one honey column (same as the app). Tablets: the form in a centred card. Laptops and up:
 * a split screen, brand panel with the swipe cards on the left, the form on a clean panel on the right.
 */
export default function LoginPage() {
  const terms = (
    <p className="text-center text-xs text-ink/70 lg:text-ink-soft">
      By continuing you agree to our{" "}
      <Link href="/terms" className="underline">
        Terms
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className="underline">
        Privacy policy
      </Link>
      , and to meet safely, be kind, and only list things you own.
    </p>
  );

  return (
    <div className="min-h-dvh bg-honey lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Brand panel (laptops and up) */}
      <aside className="relative hidden overflow-hidden lg:flex lg:flex-col lg:px-12 lg:py-10 xl:px-16">
        <Link href="/" className="self-start" aria-label="Phenko Mat home">
          <Wordmark />
        </Link>
        {/* The card stack needs ~400 px beside the text, so it only appears on very wide screens. */}
        <div className="my-auto grid items-center gap-12 py-10 2xl:grid-cols-[minmax(0,1fr)_400px]">
          <div>
            <p className="text-5xl leading-[1.02] font-black tracking-tight xl:text-6xl">
              Don&apos;t throw it.
              <br />
              Pass it on.
            </p>
            <ul className="mt-8 max-w-md space-y-4">
              {POINTS.map((p) => (
                <li key={p.text} className="flex items-start gap-3 text-lg">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-xl" aria-hidden="true">
                    {p.emoji}
                  </span>
                  <span className="pt-1.5">{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="hidden w-[400px] 2xl:block">
            <HeroCards />
          </div>
        </div>
        <p className="text-sm font-semibold text-ink/70">Made to keep good things out of landfill.</p>
      </aside>

      {/* Sign-in panel */}
      <main className="flex min-h-dvh flex-col px-6 py-8 md:items-center md:justify-center md:py-12 lg:bg-white lg:px-12">
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col md:flex-none md:rounded-[32px] md:bg-white md:p-10 md:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.25)] lg:max-w-[420px] lg:p-0 lg:shadow-none">
          {/* Phones and tablets: the logo lives here (the brand panel is hidden). */}
          <Link href="/" className="self-start lg:hidden" aria-label="Phenko Mat home">
            <Wordmark />
          </Link>
          <div className="my-auto py-10 md:my-0 md:pt-8 md:pb-0 lg:pt-0">
            {/* One h1 per breakpoint: the slogan on phones/tablets, a plain title next to the brand panel. */}
            <h1 className="text-[2.6rem] leading-[1.05] font-black tracking-tight md:text-4xl lg:hidden">
              Don&apos;t throw it.
              <br />
              Pass it on.
            </h1>
            <h1 className="hidden text-3xl font-black tracking-tight lg:block">Welcome to Phenko Mat</h1>
            <p className="mt-3 mb-8 text-lg lg:text-base lg:text-ink-soft">
              Sign in to swipe on things your neighbours are giving away.
            </p>
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
          <div className="mt-auto pt-8 md:mt-8">{terms}</div>
        </div>
      </main>
    </div>
  );
}
