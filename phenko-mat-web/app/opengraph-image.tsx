import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SEO } from "@/lib/seo";
import { SITE } from "@/lib/site";

/*
 * The card shown when the site is shared on WhatsApp, Instagram, LinkedIn, X, iMessage… Every page
 * inherits it unless it adds its own opengraph-image.
 */
export const alt = `${SITE.name}: ${SEO.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [font, logo] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/PlusJakartaSans-ExtraBold.ttf")),
    readFile(join(process.cwd(), "app/icon.svg"), "base64"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#FFC629",
          color: "#1D1D1D",
          fontFamily: "Jakarta",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src={`data:image/svg+xml;base64,${logo}`} width={96} height={96} alt="" />
          <span style={{ fontSize: 44, letterSpacing: "-0.03em" }}>{SITE.name.toLowerCase()}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 92, lineHeight: 1.02, letterSpacing: "-0.04em" }}>Don&apos;t throw it away.</span>
          <span style={{ fontSize: 92, lineHeight: 1.02, letterSpacing: "-0.04em" }}>Pass it on.</span>
        </div>
        <span style={{ fontSize: 34, letterSpacing: "-0.01em", opacity: 0.75 }}>
          Pass on and find second-hand things near you
        </span>
      </div>
    ),
    { ...size, fonts: [{ name: "Jakarta", data: font, weight: 800, style: "normal" }] },
  );
}
