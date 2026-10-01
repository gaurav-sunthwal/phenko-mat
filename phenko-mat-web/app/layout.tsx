import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ErrorReporter } from "@/components/ErrorReporter";
import { SEO, SITE_URL } from "@/lib/seo";
import { SITE } from "@/lib/site";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SEO.title, template: `%s · ${SITE.name}` },
  description: SEO.description,
  keywords: [...SEO.keywords],
  applicationName: SITE.name,
  category: "lifestyle",
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SEO.locale,
    title: SEO.title,
    description: SEO.description,
  },
  twitter: { card: "summary_large_image", title: SEO.title, description: SEO.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  appleWebApp: { title: SITE.name, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ffc629",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <ErrorReporter />
      </body>
    </html>
  );
}
