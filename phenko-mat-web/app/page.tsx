import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, faqJsonLd, HOME_FAQ, jsonLdScript, organizationJsonLd, pageMetadata, SEO } from "@/lib/seo";
import { LEGAL_LINKS, SITE } from "@/lib/site";
import { HeroCards } from "@/components/HeroCards";
import { Wordmark } from "@/components/ui";
import { DEFAULT_CATEGORIES } from "@/lib/catalog";

export const metadata: Metadata = pageMetadata({ path: "/", description: SEO.description });

/** Who we are, the site, the web app, and the FAQ below, linked into one graph for search engines and AI. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    organizationJsonLd(),
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      name: SITE.name,
      url: absoluteUrl("/"),
      description: SEO.description,
      inLanguage: "en-IN",
      publisher: { "@id": absoluteUrl("/#organization") },
    },
    {
      "@type": "WebApplication",
      "@id": absoluteUrl("/#app"),
      name: SITE.name,
      url: absoluteUrl("/"),
      description: SEO.definition,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Any (web browser)",
      browserRequirements: "Requires JavaScript",
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
      publisher: { "@id": absoluteUrl("/#organization") },
    },
    faqJsonLd(HOME_FAQ),
  ],
};

const STEPS = [
  { n: "1", title: "Snap & list", body: "Photograph the thing you don't use anymore. Pick a category and set a small price — even ₹1." },
  { n: "2", title: "Neighbours swipe", body: "People nearby see it in their feed. Right swipe means “I want this”, left means “not for me”." },
  { n: "3", title: "Connect & hand over", body: "A right swipe opens a chat. Agree on a time, meet up, and it finds a second home." },
];

export default function Home() {
  return (
    <div className="bg-paper">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(JSON_LD)} />
      <section className="relative overflow-hidden bg-honey">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Wordmark />
          <Link href="/login" className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black">
            Sign in
          </Link>
        </nav>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-8 pb-20 md:grid-cols-2 md:pt-16 md:pb-28">
          <div>
            <p className="mb-4 inline-block rounded-full bg-ink px-3 py-1 text-xs font-bold tracking-wider text-honey uppercase">
              Phenko mat · don&apos;t throw it away
            </p>
            <h1 className="text-5xl leading-[1.02] font-black tracking-tight md:text-7xl">
              Make the
              <br />
              first swap.
            </h1>
            <p className="mt-6 max-w-md text-lg md:text-xl">
              Pass on what you don&apos;t need and find second-hand things from people near you, from ₹1. Swipe
              through what neighbours are passing on and connect in one tap.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/feed" className="rounded-full bg-ink px-7 py-4 text-lg font-extrabold text-white transition hover:bg-black">
                Start swiping
              </Link>
              <Link href="/new" className="rounded-full border-2 border-ink px-7 py-4 text-lg font-extrabold transition hover:bg-ink/5">
                Give something away
              </Link>
            </div>
          </div>

          <HeroCards />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-4xl font-black tracking-tight md:text-5xl">How it works</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-[28px] bg-white p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-honey text-xl font-black">{s.n}</span>
              <h3 className="mt-5 text-2xl font-extrabold">{s.title}</h3>
              <p className="mt-2 text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink py-20 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-4xl font-black tracking-tight md:text-5xl">
            From <span className="text-honey">premium</span> finds to <span className="text-honey">daily needs</span>.
          </h2>
          <p className="mt-4 max-w-xl text-white/70">
            Browse by category, or create your own. The catalogue grows with your neighbourhood.
          </p>
          <ul className="mt-10 flex flex-wrap gap-3">
            {DEFAULT_CATEGORIES.map((c) => (
              <li key={c.id} className="rounded-full bg-white/10 px-5 py-3 text-lg font-bold">
                <span aria-hidden="true">{c.emoji}</span> {c.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-5 py-20 md:grid-cols-3">
        {[
          ["📍", "Only nearby", "Your exact location is never shown — just the area and distance."],
          ["🛡️", "Verified accounts", "Every account is verified by email, Google or Apple before it can list or chat."],
          ["🤝", "Meet safely", "Chat first, meet somewhere public, and check the item before you pay."],
        ].map(([emoji, title, body]) => (
          <div key={title} className="rounded-[28px] border border-line p-7">
            <span className="text-4xl" aria-hidden="true">
              {emoji}
            </span>
            <h3 className="mt-4 text-xl font-extrabold">{title}</h3>
            <p className="mt-2 text-ink-soft">{body}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-20" aria-labelledby="faq">
        <h2 id="faq" className="text-4xl font-black tracking-tight md:text-5xl">
          Questions, answered
        </h2>
        <div className="mt-8 space-y-3">
          {HOME_FAQ.map(({ q, a }) => (
            <details key={q} className="group rounded-[24px] bg-white p-6 open:pb-7">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-extrabold">
                <h3>{q}</h3>
                <span aria-hidden="true" className="text-2xl transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-honey">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between">
          <h2 className="text-4xl font-black tracking-tight">Someone nearby needs that.</h2>
          <Link href="/login" className="rounded-full bg-ink px-7 py-4 text-lg font-extrabold text-white transition hover:bg-black">
            Join Phenko Mat
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-ink-soft md:flex-row md:items-center md:justify-between">
        <Wordmark className="text-ink" />
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
