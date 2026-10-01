"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Category } from "@/lib/dto";
import { useRecentSearches } from "@/lib/client/stores/recentSearches";
import { SearchIcon, StackIcon, XIcon } from "./icons";

const MAX_QUERY = 80;

/**
 * Search bar on Browse (same as the app). Typing filters categories on the spot; submitting (or the
 * "Swipe through" row) opens the matching listings as a swipe deck. Recent searches show while empty.
 */
export function CategorySearch({ categories, query, onChange }: { categories: Category[]; query: string; onChange: (q: string) => void }) {
  const router = useRouter();
  const recent = useRecentSearches((s) => s.terms);
  const removeRecent = useRecentSearches((s) => s.remove);
  const term = query.trim();
  const needle = term.toLowerCase();
  const matches = needle ? categories.filter((c) => c.name.toLowerCase().includes(needle)) : [];

  useEffect(() => {
    void useRecentSearches.persist.rehydrate();
  }, []);

  function search(q: string) {
    const t = q.trim();
    if (!t) return;
    useRecentSearches.getState().add(t);
    router.push(`/categories/search?q=${encodeURIComponent(t)}`);
  }

  return (
    <div className="mt-4 space-y-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        className="flex items-center gap-2 rounded-full border-2 border-line bg-white px-4 focus-within:border-honey"
      >
        <SearchIcon size={18} className="shrink-0 text-ink-soft" />
        <input
          type="search"
          value={query}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search sofas, books, shoes…"
          maxLength={MAX_QUERY}
          enterKeyHint="search"
          aria-label="Search listings and categories"
          className="w-full bg-transparent py-3 font-medium outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => onChange("")} className="text-ink-soft" aria-label="Clear search">
            <XIcon size={16} />
          </button>
        )}
      </form>

      {term ? (
        <>
          <button
            onClick={() => search(term)}
            className="flex w-full items-center gap-3 rounded-[22px] bg-honey p-3 text-left transition hover:brightness-95"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white">
              <StackIcon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">Swipe through “{term}”</span>
              <span className="block text-xs text-ink/70">Every listing that matches, one card at a time</span>
            </span>
          </button>
          {matches.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-bold text-ink-soft">Categories</p>
              <div className="flex flex-wrap gap-2">
                {matches.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/categories/${c.id}`)}
                    className="rounded-full border-2 border-line bg-white px-3.5 py-2 text-sm font-semibold hover:border-ink"
                  >
                    <span aria-hidden="true">{c.emoji}</span> {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        recent.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-bold text-ink-soft">Recent</p>
            <div className="flex flex-wrap gap-2">
              {recent.map((t) => (
                <span key={t} className="inline-flex items-center rounded-full border-2 border-line bg-white text-sm font-semibold">
                  <button onClick={() => search(t)} className="py-2 pr-1 pl-3.5">
                    {t}
                  </button>
                  <button
                    onClick={() => removeRecent(t)}
                    className="mr-1 rounded-full p-1.5 text-ink-soft hover:bg-cream hover:text-ink"
                    aria-label={`Remove “${t}” from recent searches`}
                  >
                    <XIcon size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
