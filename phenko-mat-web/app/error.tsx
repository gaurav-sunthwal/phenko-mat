"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client/reportError";

/** A page crashed while rendering: report it, and let the user try again. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportClientError(error, { kind: "render" });
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
      <p className="text-5xl" aria-hidden="true">
        🙈
      </p>
      <h1 className="mt-4 text-2xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-ink-soft">We&apos;ve been told about it. Try again, and if it keeps happening, come back in a bit.</p>
      <button onClick={() => retry()} className="mt-6 rounded-full bg-ink px-6 py-3 font-bold text-white">
        Try again
      </button>
    </div>
  );
}
