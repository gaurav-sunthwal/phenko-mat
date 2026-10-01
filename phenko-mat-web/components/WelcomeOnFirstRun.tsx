"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMe } from "@/lib/client/hooks";
import { useOnboarding } from "@/lib/client/stores/onboarding";

/** New here (no interests yet, welcome not seen in this browser): ask what they're looking for first. */
export function WelcomeOnFirstRun() {
  const { data: me } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const shown = useRef(false);
  const userId = me?.id;
  const needsWelcome = me ? me.interests.length === 0 : false;

  useEffect(() => {
    if (!userId || !needsWelcome || shown.current || pathname === "/welcome") return;
    let cancelled = false;
    void Promise.resolve(useOnboarding.persist.rehydrate()).then(() => {
      if (cancelled || shown.current || useOnboarding.getState().seen[userId]) return;
      shown.current = true;
      // Remember the page it interrupted (e.g. a chat link) so finishing returns there.
      router.push(`/welcome?from=${encodeURIComponent(location.pathname + location.search)}`);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, needsWelcome, pathname, router]);

  return null;
}
