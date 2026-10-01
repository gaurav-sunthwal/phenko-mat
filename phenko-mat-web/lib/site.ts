/** Public facts about the service, used by the legal and help pages (and linked from the app). */
export const SITE = {
  name: "Phenko Mat",
  // TODO(owner): replace with the real support inbox before launch.
  supportEmail: "support@phenkomat.app",
  /** Shown on the legal pages; update whenever their content changes. */
  legalUpdated: "1 October 2026",
} as const;

export const LEGAL_LINKS = [
  { href: "/help", label: "Help & FAQ" },
  { href: "/guidelines", label: "Community guidelines" },
  { href: "/terms", label: "Terms of service" },
  { href: "/privacy", label: "Privacy policy" },
] as const;
