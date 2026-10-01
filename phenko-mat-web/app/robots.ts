import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * Signed-in screens (see proxy.ts) and the API have nothing for crawlers; keep crawl budget on public pages.
 * /login stays crawlable on purpose: it is kept out of results by its noindex tag, which a blocked page never shows.
 */
const PRIVATE = ["/api/", "/feed", "/categories", "/profile", "/chats", "/chat/", "/new", "/listing/", "/welcome", "/u/"];

/*
 * AI crawlers, allowed on purpose: being readable by assistants is how people find us when they ask
 * "where can I give away my old sofa?". `*` already allows them; naming them documents the intent and
 * survives anyone later adding a blanket block.
 */
const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "ClaudeBot", "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Google-Extended", "Applebot-Extended", "Bingbot", "meta-externalagent", "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
