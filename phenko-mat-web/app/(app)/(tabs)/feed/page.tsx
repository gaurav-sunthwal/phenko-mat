import type { Metadata } from "next";
import { SwipeDeck } from "@/components/SwipeDeck";

export const metadata: Metadata = { title: "Feed" };

export default function FeedPage() {
  return (
    <>
      {/* Phones get this context from the header; big screens get a proper page title. */}
      <div className="hidden px-4 pt-8 pb-5 md:mx-auto md:block md:w-full md:max-w-[480px]">
        <h1 className="text-3xl font-black">Discover</h1>
        <p className="mt-1 text-ink-soft">Swipe right on anything you&apos;d like and we&apos;ll connect you with the owner.</p>
      </div>
      <SwipeDeck />
    </>
  );
}
