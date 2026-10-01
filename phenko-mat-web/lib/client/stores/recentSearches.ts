"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX_RECENT = 6;

interface RecentSearches {
  /** Newest first, de-duplicated case-insensitively. Kept in this browser only. */
  terms: string[];
  add: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

/**
 * Hydrated by the search box after mount (`skipHydration`), so the server-rendered HTML (no
 * localStorage) and the first client render match.
 */
export const useRecentSearches = create<RecentSearches>()(
  persist(
    (set) => ({
      terms: [],
      add: (term) =>
        set((s) => ({
          terms: [term, ...s.terms.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT),
        })),
      remove: (term) => set((s) => ({ terms: s.terms.filter((t) => t !== term) })),
      clear: () => set({ terms: [] }),
    }),
    { name: "recent-searches", skipHydration: true },
  ),
);
