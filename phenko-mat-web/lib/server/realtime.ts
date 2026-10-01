import "server-only";
import { after } from "next/server";
import type { PublishRequest, ServerEvent } from "@/lib/realtime/protocol";
import { createTicket } from "@/lib/realtime/ticket";
import { realtimeEnv } from "./env";

const PUBLISH_TIMEOUT_MS = 2_000;

export function issueTicket(userId: string, native = false) {
  const env = realtimeEnv();
  return { ticket: createTicket(userId, env.REALTIME_SECRET, Date.now(), native), url: env.NEXT_PUBLIC_REALTIME_URL };
}

async function send(body: PublishRequest) {
  const env = realtimeEnv();
  try {
    const res = await fetch(`${env.REALTIME_INTERNAL_URL}/internal/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.REALTIME_SECRET}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
    });
    if (!res.ok) console.warn(`[realtime] publish ${body.event.type} → HTTP ${res.status}`);
  } catch (e) {
    // Best effort: Postgres already has the data and clients resync on reconnect.
    console.warn(`[realtime] publish ${body.event.type} failed:`, (e as Error).message);
  }
}

/**
 * Pushes an event to users' open sockets once the HTTP response has been sent, so a slow or
 * down gateway never delays (or fails) the API call that caused it.
 */
export function publish(userIds: string[], event: ServerEvent) {
  const task = () => send({ userIds, event });
  try {
    after(task);
  } catch {
    // Outside a request (scripts/tests): just fire it.
    void task();
  }
}
