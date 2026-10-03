import type { Metadata } from "next";
import Link from "next/link";
import { faqJsonLd, jsonLdScript, pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/help",
  title: "Help & FAQ",
  description: `Answers about ${SITE.name}: how passing on and finding things works, pricing, safety, location privacy and your account.`,
});

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does it work?",
    a: "List things you no longer need. People nearby swipe through listings; swiping right on yours opens a chat with you, where you agree on a pickup.",
  },
  {
    q: "How much does it cost?",
    a: "Each owner sets a price, from as little as ₹1, which you pay them directly when you pick the item up. We never handle payments, and the app itself costs nothing to use.",
  },
  {
    q: "Who can see my location?",
    a: "Only your area name (for example “Koregaon Park”) and a rounded distance. Your exact location is never shown to anyone.",
  },
  {
    q: "I passed on something by mistake.",
    a: "Tap the undo button next to Pass. You can also bring back everything you passed from the “You've seen it all” screen.",
  },
  {
    q: "How do I mark something as given?",
    a: "On your profile, tap “Mark as given” on the listing, or use the button in the chat. If several people asked for it, you can pick who got it.",
  },
  {
    q: "Someone is being rude, spammy or suspicious.",
    a: "Open their profile or the chat menu and choose Report or Block. Blocking ends your chats with them and hides each of you from the other. Reports are reviewed by our team.",
  },
  {
    q: "How do I delete my account?",
    a: "Profile → Delete my account. Your listings, chats and photos are deleted permanently.",
  },
];

export default function HelpPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript({ "@context": "https://schema.org", ...faqJsonLd(FAQ) })} />
      <h1>Help &amp; FAQ</h1>
      <p className="text-ink-soft">Quick answers. Can&apos;t find yours? Write to us, we reply within a couple of days.</p>
      {FAQ.map(({ q, a }) => (
        <section key={q}>
          <h2>{q}</h2>
          <p>{a}</p>
        </section>
      ))}
      <h2>Staying safe</h2>
      <ul>
        <li>Meet somewhere public and in daylight, or bring someone along.</li>
        <li>Check the item before paying. Never pay in advance or share OTPs, bank or card details.</li>
        <li>Keep the conversation in the app until you&apos;ve agreed on a pickup.</li>
      </ul>
      <h2>Contact</h2>
      <p>
        Email <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. Please read our{" "}
        <Link href="/guidelines">community guidelines</Link> too.
      </p>
    </>
  );
}
