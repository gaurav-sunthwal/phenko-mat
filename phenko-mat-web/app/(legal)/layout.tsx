import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui";
import { LEGAL_LINKS, SITE } from "@/lib/site";

/** Public, readable pages (no sign-in): help and the legal documents the app stores require. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label={`${SITE.name} home`}>
          <Wordmark />
        </Link>
        <Link href="/feed" className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-black">
          Open the app
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 pb-16">
        <article className="rounded-[28px] bg-white p-6 leading-relaxed md:p-10 [&_a]:font-semibold [&_a]:underline [&_h1]:text-3xl [&_h1]:font-black md:[&_h1]:text-4xl [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-extrabold [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </article>
      </main>
      <footer className="mx-auto flex max-w-3xl flex-wrap gap-x-5 gap-y-2 px-5 pb-10 text-sm text-ink-soft">
        {LEGAL_LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-ink">
            {l.label}
          </Link>
        ))}
        <a href={`mailto:${SITE.supportEmail}`} className="hover:text-ink">
          Contact us
        </a>
      </footer>
    </div>
  );
}
