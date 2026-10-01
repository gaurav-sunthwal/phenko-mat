"use client";

/**
 * View pings for listing owners' analytics (same as the app's features/feed/views.ts), batched so
 * swiping never waits on the network. Best effort: a failed batch is dropped (the server also counts
 * anyone who swiped as a viewer).
 */
const FLUSH_MS = 4_000;
const MAX_BATCH = 20;

const seen = new Set<string>();
const details = new Set<string>();
/** Already sent this page session; the server dedupes too, this just saves requests. */
const sent = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!seen.size && !details.size) return;
  const body = JSON.stringify({ seen: [...seen], details: [...details] });
  seen.clear();
  details.clear();
  // keepalive: the batch still goes out when the tab is being hidden or closed.
  void fetch("/api/views", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => undefined);
}

function schedule() {
  // Don't lose a pending batch when the tab goes to the background or closes (web's AppState).
  if (!listening && typeof document !== "undefined") {
    listening = true;
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
    window.addEventListener("pagehide", flush);
  }
  if (seen.size + details.size >= MAX_BATCH) return flush();
  timer ??= setTimeout(flush, FLUSH_MS);
}

/** The card reached the top of the deck (or someone else's listing was opened). */
export function trackSeen(itemId: string) {
  if (sent.has(`s:${itemId}`)) return;
  sent.add(`s:${itemId}`);
  seen.add(itemId);
  schedule();
}

/** The details panel (ⓘ) was opened. */
export function trackDetails(itemId: string) {
  if (sent.has(`d:${itemId}`)) return;
  sent.add(`d:${itemId}`);
  details.add(itemId);
  schedule();
}
