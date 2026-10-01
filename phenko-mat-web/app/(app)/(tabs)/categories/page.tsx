"use client";

import Link from "next/link";
import { useState } from "react";
import { PlusIcon } from "@/components/icons";
import { CategorySearch } from "@/components/CategorySearch";
import { NewCategorySheet } from "@/components/NewCategorySheet";
import { ErrorNote, Spinner } from "@/components/ui";
import { useCategories } from "@/lib/client/hooks";
import type { Category } from "@/lib/dto";

const TIER_STYLE: Record<string, string> = {
  premium: "bg-ink text-honey",
  normal: "bg-honey text-ink",
  "daily-needs": "bg-[#B8E0D2] text-ink",
};

function count(c: Category) {
  const total = `${c.totalCount} ${c.totalCount === 1 ? "item" : "items"}`;
  return c.nearbyCount > 0 ? `${c.nearbyCount} nearby · ${total}` : total;
}

export default function CategoriesPage() {
  const { data, error, isLoading, mutate } = useCategories();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;

  if (error) return <ErrorNote message={error.message} onRetry={() => mutate()} />;
  if (isLoading || !data) return <Spinner />;

  const tiers = data.filter((c) => c.group === "tier");
  const others = data.filter((c) => c.group !== "tier");

  return (
    <div className="px-4 pt-2 pb-8 md:mx-auto md:w-full md:max-w-6xl md:px-8 md:pt-8 md:pb-12">
      <h1 className="text-3xl font-black md:text-4xl">Browse</h1>
      <p className="mt-1 text-ink-soft">Pick a category and swipe through just that.</p>

      <div className="md:max-w-2xl">
        <CategorySearch categories={data} query={query} onChange={setQuery} />
      </div>

      {/* While searching, the results above replace the browse sections (same as the app). */}
      {!searching && (
        <>
          <div className="mt-5 space-y-3 md:grid md:grid-cols-3 md:gap-4 md:space-y-0">
            {tiers.map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.id}`}
                className={`flex items-center justify-between rounded-[24px] p-5 transition hover:-translate-y-0.5 md:min-h-[140px] md:p-6 ${TIER_STYLE[c.id] ?? "bg-cream"}`}
              >
                <div>
                  <p className="text-xl font-extrabold">{c.name}</p>
                  {c.blurb && <p className="mt-0.5 text-sm opacity-80">{c.blurb}</p>}
                  <p className="mt-2 text-xs font-bold tracking-wide uppercase opacity-70">{count(c)}</p>
                </div>
                <span className="text-5xl" aria-hidden="true">
                  {c.emoji}
                </span>
              </Link>
            ))}
          </div>

          <h2 className="mt-8 mb-3 text-lg font-extrabold md:mt-12 md:text-xl">All categories</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {others.map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.id}`}
                className="flex flex-col justify-between rounded-[22px] border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-honey"
              >
                <span className="text-3xl" aria-hidden="true">
                  {c.emoji}
                </span>
                <span className="mt-3 font-bold">{c.name}</span>
                <span className="text-xs text-ink-soft">{count(c)}</span>
              </Link>
            ))}
            <button
              onClick={() => setCreating(true)}
              className="flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-[22px] border-2 border-dashed border-line p-4 font-bold text-ink-soft transition hover:border-honey hover:text-ink"
            >
              <PlusIcon size={26} />
              New category
            </button>
          </div>
        </>
      )}

      <NewCategorySheet open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
