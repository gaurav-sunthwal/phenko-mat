"use client";

import Script from "next/script";
import { useEffect } from "react";
import { useMe } from "@/lib/client/hooks";

/*
 * Microsoft Clarity: session replays and heatmaps for the website (the native app has its own SDK, see
 * phenko-mat/src/lib/analytics.ts). Off unless NEXT_PUBLIC_CLARITY_PROJECT_ID is set.
 *
 * Privacy (matches /privacy): the signed-in app is wrapped in <ClarityMask>, so chats, names, listings and
 * profiles are masked in recordings; users are identified only by their internal account id.
 */
const PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

/** Loads the Clarity tag once the page is interactive, so it never delays first paint. */
export function ClarityScript() {
  if (!PROJECT_ID) return null;
  const environment = process.env.NODE_ENV === "production" ? "production" : "development";
  return (
    <Script id="clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script",${JSON.stringify(PROJECT_ID)});
window.clarity("set","environment",${JSON.stringify(environment)});`}
    </Script>
  );
}

/** Links recordings to the signed-in account (internal id only, never name or email). */
export function ClarityIdentify() {
  const { data: me } = useMe();
  useEffect(() => {
    if (PROJECT_ID && me?.id) window.clarity?.("identify", me.id);
  }, [me?.id]);
  return null;
}

/** Masks everything inside it in Clarity recordings. `display: contents` keeps it out of the layout. */
export function ClarityMask({ children }: { children: React.ReactNode }) {
  return (
    <div data-clarity-mask="True" className="contents">
      {children}
    </div>
  );
}
