"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface Onboarding {
  /** Accounts that have finished or skipped the welcome in this browser (kept across sign-outs). */
  seen: Record<string, true>;
  markSeen: (userId: string) => void;
}

/** Hydrated after mount (`skipHydration`) so server HTML and the first client render match. */
export const useOnboarding = create<Onboarding>()(
  persist(
    (set) => ({
      seen: {},
      markSeen: (userId) => set((s) => ({ seen: { ...s.seen, [userId]: true } })),
    }),
    { name: "onboarding", skipHydration: true },
  ),
);
