"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { mutate } from "swr";
import type { ChatMessage, ConnectionSummary } from "@/lib/dto";
import { api, fetcher } from "./api";
import { onResync } from "./realtime";
import { useChatStore } from "./stores/chat";
import { useRealtimeStore } from "./stores/realtime";

/** Server page size: a page this full means there may be older messages. */
const PAGE = 50;

/** Only used when the socket is down, so chat keeps working (slower) through outages. */
const FALLBACK_POLL_MS = 10_000;

export function useChat(connectionId: string) {
  const base = `/api/connections/${connectionId}/messages`;
  const thread = useChatStore((s) => s.threads[connectionId]);
  const pending = useChatStore(
    useShallow((s) => Object.values(s.pending).filter((p) => p.connectionId === connectionId)),
  );
  const typing = useChatStore((s) => s.typing[connectionId]);
  const liveReadAt = useChatStore((s) => s.otherReadAt[connectionId]);
  const status = useRealtimeStore((s) => s.status);
  const lastReadSent = useRef(0);
  const [olderDone, setOlderDone] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Fetch anything newer than what we have (after reconnects, or as a fallback poll).
  const catchUp = useCallback(async () => {
    const lastId = useChatStore.getState().threads[connectionId]?.lastId ?? 0;
    const batch = await fetcher<ChatMessage[]>(lastId ? `${base}?after=${lastId}` : base).catch(() => null);
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
    if (status === "open") return;
    const t = setInterval(() => void catchUp(), FALLBACK_POLL_MS);
    return () => clearInterval(t);
  }, [status, catchUp]);

  // Read receipts: mark read when a new message from the other person is visible.
  const newestTheirs = thread?.messages.findLast((m) => !m.mine)?.id ?? 0;
  useEffect(() => {
    if (!newestTheirs || newestTheirs <= lastReadSent.current || document.visibilityState !== "visible") return;
    lastReadSent.current = newestTheirs;
    // Clear the unread badges (header, sidebar, list) now rather than after the server round trip.
    const clear = (c: ConnectionSummary) => (c.id === connectionId ? { ...c, unread: 0 } : c);
    void mutate<ConnectionSummary[]>("/api/connections", (list) => list?.map(clear), { revalidate: false });
    void mutate<ConnectionSummary>(`/api/connections/${connectionId}`, (c) => (c ? clear(c) : c), { revalidate: false });
    void api("POST", `/api/connections/${connectionId}/read`).catch(() => undefined);
  }, [newestTheirs, connectionId]);

  const post = useCallback(
    async (clientId: string, body: string) => {
      try {
        const message = await api<ChatMessage>("POST", base, { body, clientId });
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
      const clientId = crypto.randomUUID();
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

  /** Scrolling back: fetches the page before the oldest message we have. */
  const loadOlder = useCallback(async () => {
    const oldest = useChatStore.getState().threads[connectionId]?.messages[0]?.id;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const batch = await fetcher<ChatMessage[]>(`${base}?before=${oldest}`);
      useChatStore.getState().upsert(connectionId, batch);
      if (batch.length < PAGE) setOlderDone(true);
    } catch {
      // Leave the button in place so they can try again.
    } finally {
      setLoadingOlder(false);
    }
  }, [base, connectionId]);

  return {
    messages: thread?.messages ?? null,
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
