import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { SITE } from "@/lib/site";

/** Public pages only; everything else needs an account. Add new public pages here. */
export default function sitemap(): MetadataRoute.Sitemap {
  const legalUpdated = new Date(SITE.legalUpdated);
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/help"), lastModified: legalUpdated, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/guidelines"), lastModified: legalUpdated, changeFrequency: "yearly", priority: 0.5 },
    { url: absoluteUrl("/terms"), lastModified: legalUpdated, changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/privacy"), lastModified: legalUpdated, changeFrequency: "yearly", priority: 0.3 },
  ];
}
