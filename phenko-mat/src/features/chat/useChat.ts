import { randomUUID } from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { api, qs } from "@/lib/api/client";
import { queryClient } from "@/lib/query/client";
import { qk } from "@/lib/query/keys";
import { onResync } from "@/lib/realtime/socket";
import { useRealtimeStore } from "@/lib/realtime/store";
import type { ChatMessage, ConnectionSummary } from "@/shared/dto";
import { useChatStore } from "./store";

/** Only used when the socket is down, so chat keeps working (slower) through outages. */
const FALLBACK_POLL_MS = 10_000;

/** Port of phenko-mat-web/lib/client/useChat.ts. */
/** Server page size: a page this full means there may be older messages. */
const PAGE = 50;

export function useChat(id: string | null) {
  // null = a brand-new chat the server hasn't finished creating; it has no messages to load yet.
  const connectionId = id ?? "";
  const base = `/api/connections/${connectionId}/messages`;
  const thread = useChatStore((s) => s.threads[connectionId]);
  const pending = useChatStore(useShallow((s) => Object.values(s.pending).filter((p) => id !== null && p.connectionId === id)));
  const typing = useChatStore((s) => s.typing[connectionId]);
  const liveReadAt = useChatStore((s) => s.otherReadAt[connectionId]);
  const status = useRealtimeStore((s) => s.status);
  const lastReadSent = useRef(0);
  const [olderDone, setOlderDone] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  /** Scrolling back: fetches the page before the oldest message we have. */
  const loadOlder = useCallback(async () => {
    const oldest = useChatStore.getState().threads[connectionId]?.messages[0]?.id;
    if (!connectionId || !oldest) return;
    setLoadingOlder(true);
    try {
      const batch = await api.get<ChatMessage[]>(`${base}${qs({ before: oldest })}`);
      useChatStore.getState().upsert(connectionId, batch);
      if (batch.length < PAGE) setOlderDone(true);
    } catch {
      // Leave the button in place so they can try again.
    } finally {
      setLoadingOlder(false);
    }
  }, [base, connectionId]);

  // Fetch anything newer than what we have (after reconnects, or as a fallback poll).
  const catchUp = useCallback(async () => {
    if (!connectionId) return;
    const lastId = useChatStore.getState().threads[connectionId]?.lastId ?? 0;
    const batch = await api.get<ChatMessage[]>(`${base}${qs({ after: lastId || undefined })}`).catch(() => null);
    if (!batch) return;
    if (lastId) useChatStore.getState().upsert(connectionId, batch);
    else useChatStore.getState().setThread(connectionId, batch);
  }, [base, connectionId]);

  // Initial load + resync on every reconnect.
  useEffect(() => {
    void catchUp();
    return onResync(() => void catchUp());
  }, [catchUp]);

  // Degraded mode: poll while the socket isn't open.
  useEffect(() => {
    if (status === "open" || !connectionId) return;
    const t = setInterval(() => void catchUp(), FALLBACK_POLL_MS);
    return () => clearInterval(t);
  }, [status, catchUp, connectionId]);

  // Read receipts: mark read when a new message from the other person is on screen.
  const newestTheirs = thread?.messages.findLast((m) => !m.mine)?.id ?? 0;
  useEffect(() => {
    if (!newestTheirs || newestTheirs <= lastReadSent.current || AppState.currentState !== "active") return;
    lastReadSent.current = newestTheirs;
    // Clear the unread badges now rather than when the server's read receipt comes back over the socket.
    queryClient.setQueryData<ConnectionSummary[]>(qk.connections.list, (list) =>
      list?.map((c) => (c.id === connectionId ? { ...c, unread: 0 } : c)),
    );
    void api.post(`/api/connections/${connectionId}/read`).catch(() => undefined);
  }, [newestTheirs, connectionId]);

  const post = useCallback(
    async (clientId: string, body: string) => {
      try {
        const message = await api.post<ChatMessage>(base, { body, clientId });
        useChatStore.getState().upsert(connectionId, [message]);
      } catch (e) {
        useChatStore.getState().failPending(clientId);
        throw e;
      }
    },
    [base, connectionId],
  );

  /** Optimistic send: bubble appears instantly; retries reuse the same clientId (idempotent). */
  const send = useCallback(
    (body: string) => {
      const clientId = randomUUID();
      useChatStore.getState().addPending({
        clientId,
        connectionId,
        body,
        status: "sending",
        createdAt: new Date().toISOString(),
      });
      return post(clientId, body);
    },
    [connectionId, post],
  );

  const retry = useCallback(
    (clientId: string) => {
      const p = useChatStore.getState().pending[clientId];
      if (!p) return;
      useChatStore.getState().retryPending(clientId);
      return post(clientId, p.body).catch(() => undefined);
    },
    [post],
  );

  return {
    messages: thread?.messages ?? (id === null ? [] : null),
    hasOlder: !olderDone && (thread?.messages.length ?? 0) >= PAGE,
    loadingOlder,
    loadOlder,
    pending,
    typing: Boolean(typing),
    liveReadAt,
    connected: status === "open",
    send,
    retry,
  };
}
