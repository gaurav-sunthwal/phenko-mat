import Script from "next/script";

/*
 * Google Analytics 4 (Universal Analytics was shut down in 2023). Off unless NEXT_PUBLIC_GA_MEASUREMENT_ID
 * ("G-…") is set. Page views on client-side navigation come from GA4's enhanced measurement
 * ("Page changes based on browser history events", on by default in the GA4 data stream).
 */
const MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GoogleAnalytics() {
  if (!MEASUREMENT_ID) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`} strategy="afterInteractive" />
      {/* Not id="gtag"/"dataLayer": element ids become window globals and would shadow GA's own (see Clarity.tsx). */}
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag("js",new Date());gtag("config",${JSON.stringify(MEASUREMENT_ID)},{anonymize_ip:true});`}
      </Script>
    </>
  );
}
