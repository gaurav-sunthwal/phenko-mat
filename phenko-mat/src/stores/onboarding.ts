import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface Onboarding {
  /** Accounts that have finished or skipped the welcome on this device (kept across sign-outs). */
  seen: Record<string, true>;
  markSeen: (userId: string) => void;
}

export const useOnboarding = create<Onboarding>()(
  persist(
    (set) => ({
      seen: {},
      markSeen: (userId) => set((s) => ({ seen: { ...s.seen, [userId]: true } })),
    }),
    { name: "onboarding", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Resolves once the persisted state has loaded, so "not seen yet" is never a false alarm. */
export function onboardingHydrated() {
  return useOnboarding.persist.hasHydrated()
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
        const unsub = useOnboarding.persist.onFinishHydration(() => {
          unsub();
          resolve();
        });
      });
}
