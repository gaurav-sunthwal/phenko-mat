import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/terms",
  title: "Terms of service",
  description: `The terms for using ${SITE.name} to pass on, find and sell second-hand things nearby.`,
});

// Draft for v1. Have it reviewed by a lawyer before launch.
export default function TermsPage() {
  return (
    <>
      <h1>Terms of service</h1>
      <p className="text-ink-soft">Last updated {SITE.legalUpdated}</p>
      <p>
        These terms apply when you use {SITE.name} (the app and website). By creating an account you agree to them. If you
        don&apos;t agree, please don&apos;t use the service.
      </p>
      <h2>1. What we do</h2>
      <p>
        {SITE.name} helps people sell things they no longer need to others nearby. We only connect people. We are not a party to
        any exchange, don&apos;t own or inspect items, and don&apos;t handle payments.
      </p>
      <h2>2. Your account</h2>
      <ul>
        <li>You must be at least 18, or have a parent or guardian&apos;s permission.</li>
        <li>Give accurate information and keep your sign-in secure. You&apos;re responsible for activity on your account.</li>
        <li>You can delete your account at any time from your profile.</li>
      </ul>
      <h2>3. Listings and conduct</h2>
      <ul>
        <li>
          You must follow our <Link href="/guidelines">community guidelines</Link>. You&apos;re responsible for what you list
          and say, and for items you give, sell or receive.
        </li>
        <li>
          You keep ownership of your photos and text. You allow us to store and show them to other users so the service
          works, until you delete them.
        </li>
        <li>We may remove content or suspend accounts that break these terms or the guidelines.</li>
      </ul>
      <h2>4. Exchanges between users</h2>
      <p>
        Any exchange is solely between the people involved. Check items before accepting or paying, and meet safely. To the
        extent allowed by law, we aren&apos;t responsible for the quality, safety or legality of items, or for the conduct of
        users.
      </p>
      <h2>5. The service</h2>
      <p>
        We provide {SITE.name} &quot;as is&quot; and may change, pause or stop features. To the extent allowed by law, our liability
        for any claim relating to the service is limited to the amount you paid us, which is nothing for the free service.
      </p>
      <h2>6. Changes and contact</h2>
      <p>
        We may update these terms; we&apos;ll show the new date above and tell you in the app about important changes. These
        terms are governed by the laws of India. Questions: <a href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</a>.
      </p>
    </>
  );
}
