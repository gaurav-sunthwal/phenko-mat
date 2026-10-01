"use client";

import { mutate } from "swr";
import type { ConnectionSummary } from "@/lib/dto";
import type { ClientEvent, ServerEvent } from "@/lib/realtime/protocol";
import { CLOSE } from "@/lib/realtime/protocol";
import { ApiRequestError, api } from "./api";
import { useChatStore } from "./stores/chat";
import { useRealtimeStore } from "./stores/realtime";

/*
 * One WebSocket per browser tab, shared by every screen.
 *
 * - Auth: fetch a 60 s single-use ticket over HTTPS (session cookie verified there), then connect.
 * - Reconnect: exponential backoff with full jitter, capped at 30 s, so a gateway restart doesn't
 *   cause a thundering herd. Immediate retry when the browser comes back online / tab is shown.
 * - Resync: after every (re)connect, listeners re-fetch what they might have missed over HTTP.
 */

const MAX_BACKOFF_MS = 30_000;
const POLICY_BACKOFF_MS = 60_000;

let socket: WebSocket | null = null;
let wanted = false;
let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
const resyncListeners = new Set<() => void>();

const setStatus = useRealtimeStore.getState().set;

/** Called after every successful (re)connect. Returns an unsubscribe function. */
export function onResync(listener: () => void) {
  resyncListeners.add(listener);
  return () => {
    resyncListeners.delete(listener);
  };
}

function refreshConnectionLists() {
  mutate("/api/connections");
}

/**
 * Moves a chat to the top of the list with its new last message straight away; the refetch that
 * follows only reconciles (e.g. the unread count, which the server decides).
 */
function bumpConnection(connectionId: string, message: { body: string; mine: boolean; createdAt: string }) {
  mutate<ConnectionSummary[]>(
    "/api/connections",
    (list) => {
      const current = list?.find((c) => c.id === connectionId);
      if (!list || !current) return list;
      const updated = { ...current, lastMessage: { body: message.body, mine: message.mine, createdAt: message.createdAt } };
      return [updated, ...list.filter((c) => c.id !== connectionId)];
    },
    { revalidate: false },
  );
}

/** Takes a deleted chat out of the list right away (the refetch that follows would too, a moment later). */
export function dropConnection(connectionId: string) {
  mutate<ConnectionSummary[]>("/api/connections", (list) => list?.filter((c) => c.id !== connectionId), {
    revalidate: false,
  });
}

function handle(event: ServerEvent) {
  const chat = useChatStore.getState();
  const me = useRealtimeStore.getState().userId;

  switch (event.type) {
    case "ready":
      attempt = 0;
      setStatus({ status: "open", userId: event.userId });
      resyncListeners.forEach((l) => l());
      refreshConnectionLists();
      break;

    case "message.new": {
      const { connectionId, ...m } = event.message;
      const mine = m.senderId === me;
      chat.upsert(connectionId, [{ ...m, mine }]);
      bumpConnection(connectionId, { body: m.body, mine, createdAt: m.createdAt });
      refreshConnectionLists();
      break;
    }

    case "connection.new":
      refreshConnectionLists();
      mutate("/api/me/items");
      mutate("/api/me");
      break;

    case "connection.removed":
      chat.removeThread(event.connectionId, event.removedBy);
      dropConnection(event.connectionId);
      refreshConnectionLists();
      mutate("/api/me/items");
      mutate("/api/me/likes");
      mutate("/api/me");
      break;

    case "connection.read":
      if (event.readerId !== me) chat.setOtherReadAt(event.connectionId, event.readAt);
      else refreshConnectionLists(); // read on another of my devices → clear unread badges here too
      break;

    case "typing":
      if (event.userId !== me) chat.setTyping(event.connectionId, event.userId);
      break;
  }
}

function scheduleReconnect(policy = false) {
  if (!wanted) return;
  clearTimeout(retryTimer);
  const cap = policy ? POLICY_BACKOFF_MS : Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
  const delay = Math.random() * cap;
  attempt++;
  setStatus({ status: "reconnecting" });
  retryTimer = setTimeout(open, delay);
}

async function open() {
  if (!wanted || socket) return;
  setStatus({ status: useRealtimeStore.getState().status === "idle" ? "connecting" : "reconnecting" });

  let ticket: string;
  let url: string;
  try {
    ({ ticket, url } = await api<{ ticket: string; url: string }>("POST", "/api/realtime/ticket"));
  } catch (e) {
    // 401 is handled globally (redirect to login); anything else → try again later.
    if (!(e instanceof ApiRequestError && e.status === 401)) scheduleReconnect();
    return;
  }
  if (!wanted || socket) return;

  const ws = new WebSocket(`${url}?ticket=${encodeURIComponent(ticket)}`);
  socket = ws;

  ws.onmessage = (msg) => {
    try {
      handle(JSON.parse(String(msg.data)) as ServerEvent);
    } catch {
      // Ignore malformed frames.
    }
  };

  ws.onclose = (ev) => {
    if (socket === ws) socket = null;
    scheduleReconnect(ev.code === CLOSE.POLICY || ev.code === CLOSE.UNAUTHORIZED);
  };
}

function reconnectNow() {
  if (!wanted || socket) return;
  clearTimeout(retryTimer);
  attempt = 0;
  void open();
}

function onVisibility() {
  if (document.visibilityState === "visible") reconnectNow();
}

export function connectRealtime() {
  if (wanted) return;
  wanted = true;
  window.addEventListener("online", reconnectNow);
  document.addEventListener("visibilitychange", onVisibility);
  void open();
}

export function disconnectRealtime() {
  wanted = false;
  clearTimeout(retryTimer);
  window.removeEventListener("online", reconnectNow);
  document.removeEventListener("visibilitychange", onVisibility);
  socket?.close(1000, "bye");
  socket = null;
  setStatus({ status: "idle", userId: null });
}

const lastTypingSent = new Map<string, number>();

/** Throttled "I'm typing" signal. Fire-and-forget; silently dropped while offline. */
export function sendTyping(connectionId: string) {
  const now = Date.now();
  if (now - (lastTypingSent.get(connectionId) ?? 0) < 2_000) return;
  if (socket?.readyState !== WebSocket.OPEN) return;
  lastTypingSent.set(connectionId, now);
  const event: ClientEvent = { type: "typing", connectionId };
  socket.send(JSON.stringify(event));
}
