import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { SwipeDeck } from "@/components/SwipeDeck";

export const metadata: Metadata = { title: "Search" };

/** Search results as a swipe deck: `/categories/search?q=sofa`. */
export default async function SearchDeckPage({ searchParams }: PageProps<"/categories/search">) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 80) ?? "";
  return (
    <>
      <div className="flex items-center gap-3 px-4 pb-3 md:mx-auto md:w-full md:max-w-[480px] md:pt-8 md:pb-5">
        <Link
          href="/categories"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
          aria-label="Back to browse"
        >
          <ArrowLeftIcon size={18} />
        </Link>
        <h1 className="truncate text-2xl font-black">“{query}”</h1>
      </div>
      <SwipeDeck key={query} query={query} />
    </>
  );
}
