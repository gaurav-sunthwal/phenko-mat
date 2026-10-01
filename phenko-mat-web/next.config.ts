import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Geolocation is used by the location picker (same origin only).
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  // Firebase sign-in popups need to talk back to this window.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

// Uploaded photos are served from R2 — the r2.dev URL in development, a custom domain in production.
const r2Host = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : undefined;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/v0/b/**" },
      { protocol: "https", hostname: "**.r2.dev" },
      ...(r2Host ? [{ protocol: "https" as const, hostname: r2Host }] : []),
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  // Firebase's sign-in handler, served from our own origin. With NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN set to this site's
  // host, the Google/Apple redirect stays first-party — browsers that block third-party storage (Safari, Firefox,
  // Brave) otherwise drop the sign-in when it comes back from <project>.firebaseapp.com.
  async rewrites() {
    const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!project) return [];
    return [
      { source: "/__/auth/:path*", destination: `https://${project}.firebaseapp.com/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `https://${project}.firebaseapp.com/__/firebase/:path*` },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The Firebase SDK frames /__/auth/iframe from this same origin to finish sign-in; DENY would block that.
      { source: "/__/auth/:path*", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }] },
    ];
  },
};

export default nextConfig;
