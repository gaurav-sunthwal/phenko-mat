import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/privacy",
  title: "Privacy policy",
  description: `How ${SITE.name} collects, uses and protects your data. Your exact location is never shown to other people.`,
});

// Draft for v1, written for India's DPDP Act 2023 and the app-store requirements. Review before launch.
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="text-ink-soft">Last updated {SITE.legalUpdated}</p>
      <p>This explains what {SITE.name} collects, why, and the choices you have.</p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> your name, email address and profile photo, from Google, Apple or email sign-in.
        </li>
        <li>
          <strong>Location:</strong> the approximate location and area name you set, used to show things near you. Other
          people only see your area name and a rounded distance, never your exact location.
        </li>
        <li>
          <strong>Your content:</strong> listings, photos, profile bio, interests, and messages you send. Photos are
          re-encoded on your device before upload, which removes hidden data such as GPS coordinates.
        </li>
        <li>
          <strong>Activity:</strong> which listings you swipe on, connections, reports and blocks, used to run the feed and
          keep the community safe.
        </li>
        <li>
          <strong>Technical:</strong> basic logs (such as IP address and device type) and crash reports to keep the service
          secure and working.
        </li>
        <li>
          <strong>App usage analytics:</strong> in the app and on our website we use Microsoft Clarity to understand how screens are
          used (taps, scrolls and screen recordings with personal content such as chats, names and listings masked), so
          we can fix confusing parts
          and bugs. It&apos;s linked to an internal account number, never your name or email.
        </li>
      </ul>
      <p>We don&apos;t sell your data or show ads, and we don&apos;t use third-party advertising trackers.</p>
      <h2>Who processes it</h2>
      <p>
        We use trusted providers to run the service: Google Firebase (sign-in), Neon (database), Cloudflare R2 (photo
        storage), Microsoft Clarity (app usage analytics) and our hosting provider. They process data only on our behalf. Data may be stored outside India.
      </p>
      <h2>How long we keep it</h2>
      <ul>
        <li>Your account data until you delete your account.</li>
        <li>Photos of removed listings are deleted right away; deleting a chat deletes its messages for both people.</li>
        <li>When you delete your account, your profile, listings, chats and photos are deleted permanently.</li>
      </ul>
      <h2>Your rights</h2>
      <p>
        You can see and edit your information in the app, and delete your account from your profile at any time. You can
        also ask us for a copy of your data, a correction, or to raise a grievance, by writing to{" "}
        <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>. We reply within 30 days.
      </p>
      <h2>Children</h2>
      <p>{SITE.name} isn&apos;t meant for children under 18 without a parent or guardian&apos;s permission.</p>
      <h2>Changes</h2>
      <p>We&apos;ll update the date above when this policy changes and tell you in the app about important changes.</p>
    </>
  );
}
