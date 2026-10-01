"use client";

/** Max reports per page load, so a render loop can't spam the endpoint. */
const MAX_REPORTS = 10;
let sent = 0;
const seen = new Set<string>();

/** Sends a crash/error report to the admin Errors page. Never throws. */
export function reportClientError(error: unknown, extra?: { route?: string; kind?: string }) {
  try {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000) || "(no message)";
    const key = `${extra?.kind ?? ""}|${message}`;
    if (sent >= MAX_REPORTS || seen.has(key)) return;
    seen.add(key);
    sent++;
    const body = JSON.stringify({
      source: "web",
      message,
      stack: error instanceof Error ? error.stack?.slice(0, 8000) : undefined,
      route: (extra?.route ?? location.pathname).slice(0, 200),
      meta: {
        kind: extra?.kind ?? "error",
        ...(error instanceof Error && "digest" in error && typeof error.digest === "string" && { digest: error.digest }),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      },
    });
    // keepalive: the report still goes out if the page is being closed.
    void fetch("/api/telemetry/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  } catch {
    // Reporting must never cause another error.
  }
}
