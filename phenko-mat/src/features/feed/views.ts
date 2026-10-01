import { AppState } from "react-native";
import { api } from "@/lib/api/client";

/**
 * View pings for listing owners' analytics, batched so swiping never waits on the network. Best effort:
 * a failed batch is dropped (the server also counts anyone who swiped as a viewer).
 */
const FLUSH_MS = 4_000;
const MAX_BATCH = 20;

const seen = new Set<string>();
const details = new Set<string>();
/** Already sent this session; the server dedupes too, this just saves requests. */
const sent = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!seen.size && !details.size) return;
  const body = { seen: [...seen], details: [...details] };
  seen.clear();
  details.clear();
  void api.post("/api/views", body).catch(() => {});
}

function schedule() {
  if (seen.size + details.size >= MAX_BATCH) return flush();
  timer ??= setTimeout(flush, FLUSH_MS);
}

/** The card reached the top of the deck. */
export function trackSeen(itemId: string) {
  if (sent.has(`s:${itemId}`)) return;
  sent.add(`s:${itemId}`);
  seen.add(itemId);
  schedule();
}

/** The details sheet (ⓘ) was opened. */
export function trackDetails(itemId: string) {
  if (sent.has(`d:${itemId}`)) return;
  sent.add(`d:${itemId}`);
  details.add(itemId);
  schedule();
}

// Don't lose a pending batch when the app goes to the background.
AppState.addEventListener("change", (state) => {
  if (state !== "active") flush();
});
