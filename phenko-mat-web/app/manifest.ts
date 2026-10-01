import type { MetadataRoute } from "next";
import { SEO } from "@/lib/seo";
import { SITE } from "@/lib/site";

/** Makes the site installable ("Add to Home screen") and gives search engines the app's name and icons. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SEO.description,
    start_url: "/feed",
    display: "standalone",
    background_color: "#fbf8f1",
    theme_color: "#ffc629",
    categories: ["lifestyle", "shopping", "social"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
