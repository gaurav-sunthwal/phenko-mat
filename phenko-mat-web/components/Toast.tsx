"use client";

import { useEffect } from "react";
import { useUi } from "@/lib/client/stores/ui";
import { XIcon } from "./icons";

const TOAST_MS = 5_000;

/** One message at a time, bottom of the screen (above the phone tab bar). */
export function Toast() {
  const toast = useUi((s) => s.toast);
  const showToast = useUi((s) => s.showToast);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => showToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast, showToast]);

  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4 md:bottom-8">
      <div
        role="alert"
        className="animate-rise pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white shadow-2xl"
      >
        <p className="flex-1">{toast}</p>
        <button onClick={() => showToast(null)} className="-mr-1 rounded-full p-0.5 hover:bg-white/15" aria-label="Dismiss">
          <XIcon size={16} />
        </button>
      </div>
    </div>
  );
}
