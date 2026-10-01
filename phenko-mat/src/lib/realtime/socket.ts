import NetInfo, { type NetInfoSubscription } from "@react-native-community/netinfo";
import { AppState, type NativeEventSubscription } from "react-native";
import { env } from "@/config/env";
import { request } from "@/lib/api/client";
import { ApiRequestError } from "@/lib/api/errors";
import { queryClient } from "@/lib/query/client";
import { qk } from "@/lib/query/keys";
import { useChatStore } from "@/features/chat/store";
import type { ConnectionSummary } from "@/shared/dto";
import { CLOSE, type ClientEvent, type ServerEvent } from "@/shared/protocol";
import { useRealtimeStore } from "./store";

/*
 * One WebSocket for the whole app (port of phenko-mat-web/lib/client/realtime.ts).
 *
 * - Auth: fetch a 60 s single-use ticket over HTTPS (bearer verified there), then connect.
 * - Reconnect: exponential backoff with full jitter, capped at 30 s — no thundering herd after a
 *   gateway restart. Immediate retry when the network comes back or the app is foregrounded.
 * - Background: the socket is closed when the app goes to the background (the OS would kill it
 *   anyway) and reopened on foreground; resync then fetches anything missed over HTTP.
 */

const MAX_BACKOFF_MS = 30_000;
const POLICY_BACKOFF_MS = 60_000;

let socket: WebSocket | null = null;
let wanted = false;
let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let appStateSub: NativeEventSubscription | undefined;
let netSub: NetInfoSubscription | undefined;
const resyncListeners = new Set<() => void>();

const setStatus = (patch: Parameters<ReturnType<typeof useRealtimeStore.getState>["set"]>[0]) =>
  useRealtimeStore.getState().set(patch);

/** Called after every successful (re)connect. Returns an unsubscribe function. */
export function onResync(listener: () => void) {
  resyncListeners.add(listener);
  return () => {
    resyncListeners.delete(listener);
  };
}

const refreshConnectionLists = () => void queryClient.invalidateQueries({ queryKey: qk.connections.all });

/**
 * Moves a chat to the top of the list with its new last message straight away; the refetch that follows
 * only reconciles (e.g. the unread count, which the server decides).
 */
function bumpConnection(connectionId: string, message: { body: string; mine: boolean; createdAt: string }) {
  queryClient.setQueryData<ConnectionSummary[]>(qk.connections.list, (list) => {
    const current = list?.find((c) => c.id === connectionId);
    if (!list || !current) return list;
    const updated = { ...current, lastMessage: { body: message.body, mine: message.mine, createdAt: message.createdAt } };
    return [updated, ...list.filter((c) => c.id !== connectionId)];
  });
}

/** Takes a deleted chat out of the list right away (the refetch that follows would too, a moment later). */
function dropConnection(connectionId: string) {
  queryClient.setQueryData<ConnectionSummary[]>(qk.connections.list, (list) => list?.filter((c) => c.id !== connectionId));
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
      void queryClient.invalidateQueries({ queryKey: qk.myItems });
      void queryClient.invalidateQueries({ queryKey: qk.me });
      break;

    case "connection.removed":
      chat.removeThread(event.connectionId, event.removedBy);
      dropConnection(event.connectionId);
      refreshConnectionLists();
      void queryClient.invalidateQueries({ queryKey: qk.myItems });
      void queryClient.invalidateQueries({ queryKey: qk.likes });
      void queryClient.invalidateQueries({ queryKey: qk.me });
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
  retryTimer = setTimeout(() => void open(), delay);
}

async function open() {
  if (!wanted || socket) return;
  setStatus({ status: useRealtimeStore.getState().status === "idle" ? "connecting" : "reconnecting" });

  let ticket: string;
  let url: string;
  try {
    ({ ticket, url } = await request<{ ticket: string; url: string }>("POST", "/api/realtime/ticket"));
  } catch (e) {
    // 401 signs the user out (api client); anything else → try again later.
    if (!(e instanceof ApiRequestError && e.status === 401)) scheduleReconnect();
    return;
  }
  if (!wanted || socket) return;

  const ws = new WebSocket(`${env.realtimeUrl ?? url}?ticket=${encodeURIComponent(ticket)}`);
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

function closeSocket() {
  clearTimeout(retryTimer);
  const ws = socket;
  socket = null;
  if (ws) {
    ws.onclose = null;
    ws.close(1000, "bye");
  }
}

export function connectRealtime() {
  if (wanted) return;
  wanted = true;

  appStateSub = AppState.addEventListener("change", (state) => {
    if (state === "active") reconnectNow();
    else if (state === "background") {
      closeSocket();
      setStatus({ status: "reconnecting" });
    }
  });
  let wasOffline = false;
  netSub = NetInfo.addEventListener((s) => {
    const offline = s.isConnected === false;
    if (wasOffline && !offline) reconnectNow();
    wasOffline = offline;
  });

  void open();
}

export function disconnectRealtime() {
  wanted = false;
  appStateSub?.remove();
  netSub?.();
  appStateSub = undefined;
  netSub = undefined;
  closeSocket();
  attempt = 0;
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
