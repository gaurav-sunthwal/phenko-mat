import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const MAX_RECENT = 6;

interface RecentSearches {
  /** Newest first, de-duplicated case-insensitively. Kept on this device only. */
  terms: string[];
  add: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

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
    { name: "recent-searches", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
