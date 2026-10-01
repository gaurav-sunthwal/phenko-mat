"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { CheckIcon } from "@/components/icons";
import { LocationForm } from "@/components/LocationSetup";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import { useCategories, useMe } from "@/lib/client/hooks";
import { useOnboarding } from "@/lib/client/stores/onboarding";
import type { Me } from "@/lib/dto";

/**
 * First run (same as the app): asks what the person is looking for (saved as their interests, which
 * rank the feed) and, if missing, where they are. Once per account per browser; either step can be skipped.
 */
export function WelcomeView() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: me } = useMe();
  const { data: categories } = useCategories();
  const [picked, setPicked] = useState<string[]>([]);
  const [step, setStep] = useState<"interests" | "location">("interests");

  if (!me || !categories) return <Spinner />;
  const userId = me.id;
  const firstName = me.name.split(" ")[0];
  const options = categories.filter((c) => c.group !== "custom");

  /** Back to wherever the welcome interrupted (e.g. a chat or listing link), like the app; else the feed. */
  function finish() {
    useOnboarding.getState().markSeen(userId);
    const from = new URLSearchParams(location.search).get("from");
    // Only our own paths (never an external URL).
    router.replace(from && from.startsWith("/") && !from.startsWith("//") && from !== "/welcome" ? from : "/feed");
  }

  function next() {
    if (picked.length) {
      // Optimistic: the profile shows them now; the feed re-ranks once the save lands.
      mutate<Me>("/api/me", (m) => m && { ...m, interests: picked }, { revalidate: false });
      api<Me>("PATCH", "/api/me", { interests: picked })
        .then((updated) => {
          mutate("/api/me", updated, { revalidate: false });
          mutate((key) => typeof key === "string" && key.startsWith("/api/feed"));
        })
        .catch(() => mutate("/api/me"));
    }
    if (me?.location) finish();
    else setStep("location");
  }

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const skip = (
    <button onClick={finish} className="ml-auto block text-sm font-semibold text-ink-soft hover:text-ink">
      Skip
    </button>
  );

  if (step === "location") {
    return (
      <div className="flex min-h-dvh flex-col px-5 pt-4 pb-6 md:mx-auto md:w-full md:max-w-xl md:pt-10">
        {skip}
        <h1 className="mt-2 text-3xl font-black">Where are you?</h1>
        <p className="mt-1 mb-5 text-ink-soft">So we can show things close by. Only your area is shown, never your exact spot.</p>
        <LocationForm me={me} onDone={finish} />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col md:mx-auto md:w-full md:max-w-3xl">
      <div className="flex-1 px-5 pt-4 pb-6 md:pt-10">
        {skip}
        <h1 className="text-3xl font-black">Hi {firstName} 👋</h1>
        <h2 className="mt-2 text-xl font-extrabold">What are you looking for?</h2>
        <p className="mt-1 text-ink-soft">
          Pick a few. Your feed will show these first, and you can change them anytime on your profile.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2.5 md:grid-cols-4 lg:grid-cols-5">
          {options.map((c) => {
            const on = picked.includes(c.id);
            return (
              <button
                key={c.id}
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(c.id)}
                className={`relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[22px] border-2 p-2 text-center transition active:scale-95 ${
                  on ? "border-ink bg-honey" : "border-line bg-white hover:border-ink"
                }`}
              >
                {on && (
                  <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white">
                    <CheckIcon size={12} strokeWidth={3} />
                  </span>
                )}
                <span className="text-3xl" aria-hidden="true">
                  {c.emoji}
                </span>
                <span className="line-clamp-2 text-sm font-bold">{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="sticky bottom-0 border-t border-line bg-paper px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          onClick={next}
          disabled={!picked.length}
          className="w-full rounded-full bg-ink px-6 py-4 text-lg font-extrabold text-white transition hover:bg-black disabled:opacity-40"
        >
          {picked.length ? `Continue with ${picked.length}` : "Pick at least one"}
        </button>
      </div>
    </div>
  );
}
