import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/guidelines",
  title: "Community guidelines",
  description: `What you can and can't list on ${SITE.name}, and how to give away and pick up things safely.`,
});

export default function GuidelinesPage() {
  return (
    <>
      <h1>Community guidelines</h1>
      <p className="text-ink-soft">
        {SITE.name} works because neighbours trust each other. These rules keep it that way. Breaking them can get
        listings removed or accounts suspended.
      </p>
      <h2>List honestly</h2>
      <ul>
        <li>Only list things you own and are allowed to give or sell.</li>
        <li>Use real photos of the actual item and describe its condition and any damage.</li>
        <li>Mark items as given once they&apos;re gone.</li>
      </ul>
      <h2>Not allowed</h2>
      <ul>
        <li>Weapons, drugs, alcohol, tobacco, medicines and prescription items.</li>
        <li>Animals, counterfeit or stolen goods, recalled or unsafe products.</li>
        <li>Adult content, anything illegal, or services and job offers.</li>
        <li>Spam, repeated listings, and ads for other apps or shops.</li>
      </ul>
      <h2>Be kind and safe</h2>
      <ul>
        <li>No harassment, hate, threats or discrimination.</li>
        <li>No scams: never ask for advance payments, OTPs or bank details.</li>
        <li>Respect people&apos;s time: show up, or let them know if you can&apos;t.</li>
      </ul>
      <h2>Reporting</h2>
      <p>
        Use Report on a listing or a person&apos;s profile, and Block to stop hearing from someone. We review reports and act on
        them. For anything urgent or dangerous, contact local authorities first.
      </p>
    </>
  );
}
