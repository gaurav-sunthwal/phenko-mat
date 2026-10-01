import type { Metadata } from "next";
import { SITE } from "./site";

/*
 * One source of truth for how the site describes itself to search engines and AI assistants. The
 * landing page, structured data (JSON-LD), sitemap and /llms.txt all read from here, so the visible
 * copy and the machine-readable copy can never drift apart (Google penalises structured data that
 * doesn't match the page).
 */

/** Canonical origin, e.g. https://phenkomat.app. Set APP_ORIGIN in production or canonicals point at localhost. */
export const SITE_URL = (process.env.APP_ORIGIN ?? "http://localhost:3000").replace(/\/$/, "");

export const absoluteUrl = (path = "/") => `${SITE_URL}${path}`;

export const SEO = {
  /** Home page <title>: brand first, then what people actually search for. */
  title: `${SITE.name}: give away and get free things near you`,
  tagline: "Don't throw it away. Pass it on.",
  description:
    `${SITE.name} is a free app for giving away and finding second-hand things nearby. List what you no longer ` +
    "need, swipe through what your neighbours are giving away, and chat to arrange a pickup.",
  /** Plain-language definition, the sentence an AI assistant should quote when asked what this is. */
  definition:
    `${SITE.name} (Hindi for "don't throw it away") is a swipe-based app for giving away or selling things you ` +
    "no longer use to people nearby. You swipe through items your neighbours are giving away; swiping right " +
    "connects you with the owner in a chat, where you arrange the pickup.",
  keywords: [
    "give away things near me",
    "free stuff near me",
    "free things near me",
    "second hand items near me",
    "donate old things",
    "give away furniture",
    "declutter home",
    "reuse and recycle",
    "neighbourhood marketplace",
    "sell used items locally",
    "phenko mat",
  ],
  locale: "en_IN",
} as const;

/** Questions people (and AI assistants) ask before signing up. Shown on the home page and in its FAQPage JSON-LD. */
export const HOME_FAQ: { q: string; a: string }[] = [
  { q: `What is ${SITE.name}?`, a: SEO.definition },
  {
    q: `Is ${SITE.name} free?`,
    a: `Yes. ${SITE.name} is free to use, and most things on it are given away for free. Owners can also set a small price, which you pay them directly at pickup; ${SITE.name} never handles payments.`,
  },
  {
    q: "How do I give away things I don't need?",
    a: "Take a photo, pick a category, and choose free or a price. People nearby see it in their feed; when someone swipes right, a chat opens so you can agree on a pickup time.",
  },
  {
    q: "How do I find free things near me?",
    a: `Open ${SITE.name} and swipe through items listed by people around you, sorted by distance. Swipe right on anything you'd like and chat with the owner to collect it.`,
  },
  {
    q: "Is it safe? Who can see my location?",
    a: "Only your area name and a rounded distance are shown, never your exact location. Every account is verified by email, Google or Apple, and you can report or block anyone. Meet somewhere public and check items before paying.",
  },
  {
    q: "What can I give away?",
    a: "Furniture, electronics, books, clothes, kitchenware, toys and most everyday household things. Weapons, medicines, alcohol, animals and anything illegal are not allowed.",
  },
];

/**
 * Metadata for a public page: its canonical URL plus complete Open Graph/Twitter blocks. (A page that sets
 * `openGraph` replaces the layout's whole block rather than merging, so each page passes all of it.)
 */
export function pageMetadata({ path, title, description }: { path: string; title?: string; description: string }): Metadata {
  const fullTitle = title ? `${title} · ${SITE.name}` : SEO.title;
  return {
    ...(title && { title }),
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE.name, locale: SEO.locale, url: path, title: fullTitle, description },
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}

/** Renders JSON-LD safely: `<` is escaped so data can never close the script tag (Next.js guidance). */
export function jsonLdScript(data: object) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: SITE.name,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon.svg"),
    email: SITE.supportEmail,
    slogan: SEO.tagline,
  };
}

export function faqJsonLd(faq: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
}
