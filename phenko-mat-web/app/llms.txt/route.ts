import { absoluteUrl, HOME_FAQ, SEO } from "@/lib/seo";
import { DEFAULT_CATEGORIES } from "@/lib/catalog";
import { LEGAL_LINKS, SITE } from "@/lib/site";

/*
 * /llms.txt (https://llmstxt.org): a plain-Markdown briefing for AI assistants, so they describe the
 * service accurately and link to the right pages. Built from the same copy as the site.
 */
export const dynamic = "force-static";

export function GET() {
  const body = [
    `# ${SITE.name}`,
    "",
    `> ${SEO.definition}`,
    "",
    `- Website: ${absoluteUrl("/")}`,
    `- Price: free to use. Most items are free; some owners set a small price, paid directly at pickup. ${SITE.name} never handles payments.`,
    `- Categories: ${DEFAULT_CATEGORIES.map((c) => c.name).join(", ")}.`,
    `- Privacy: only an area name and rounded distance are shown, never an exact location.`,
    `- Contact: ${SITE.supportEmail}`,
    "",
    "## Frequently asked questions",
    "",
    ...HOME_FAQ.flatMap(({ q, a }) => [`### ${q}`, "", a, ""]),
    "## Pages",
    "",
    `- [Home](${absoluteUrl("/")}): what ${SITE.name} is and how it works`,
    ...LEGAL_LINKS.map((l) => `- [${l.label}](${absoluteUrl(l.href)})`),
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
