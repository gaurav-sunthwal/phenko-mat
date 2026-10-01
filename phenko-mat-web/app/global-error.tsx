"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client/reportError";

/** The root layout itself crashed: no app styles here, so keep it plain. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportClientError(error, { kind: "global" });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, textAlign: "center" }}>
        <div>
          <h1>Something went wrong</h1>
          <p>We&apos;ve been told about it.</p>
          <button onClick={() => retry()} style={{ padding: "10px 20px", borderRadius: 999, border: 0, background: "#1d1d1d", color: "#fff" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
