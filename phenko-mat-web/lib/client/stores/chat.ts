"use client";

import { create } from "zustand";
import type { ChatMessage } from "@/lib/dto";

export interface PendingMessage {
  clientId: string;
  connectionId: string;
  body: string;
  status: "sending" | "failed";
  createdAt: string;
}

interface Thread {
  messages: ChatMessage[];
  lastId: number;
}

interface ChatState {
  threads: Record<string, Thread>;
  /** Optimistic bubbles, keyed by clientId, until the server confirms them. */
  pending: Record<string, PendingMessage>;
  /** Live "other person read up to" timestamps from read receipts. */
  otherReadAt: Record<string, string>;
  /** connectionId → { userId, until } while the other person is typing. */
  typing: Record<string, { userId: string; until: number }>;
  /** Deleted chats → who deleted them, so an open thread can send its viewer back to the list. */
  removed: Record<string, string>;

  setThread: (connectionId: string, messages: ChatMessage[]) => void;
  upsert: (connectionId: string, messages: ChatMessage[]) => void;
  addPending: (p: PendingMessage) => void;
  failPending: (clientId: string) => void;
  retryPending: (clientId: string) => void;
  setOtherReadAt: (connectionId: string, readAt: string) => void;
  setTyping: (connectionId: string, userId: string) => void;
  clearTyping: (connectionId: string) => void;
  removeThread: (connectionId: string, removedBy: string) => void;
}

const TYPING_TTL_MS = 4_000;
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function merge(existing: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(existing.map((m) => [m.id, m]));
  incoming.forEach((m) => byId.set(m.id, m));
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export const useChatStore = create<ChatState>()((set, get) => ({
  threads: {},
  pending: {},
  otherReadAt: {},
  typing: {},
  removed: {},

  setThread: (connectionId, messages) =>
    set((s) => {
      // Keep anything that arrived over the socket while the initial page was loading.
      const merged = merge(s.threads[connectionId]?.messages ?? [], messages);
      return {
        threads: { ...s.threads, [connectionId]: { messages: merged, lastId: merged.at(-1)?.id ?? 0 } },
      };
    }),

  upsert: (connectionId, incoming) => {
    if (!incoming.length) return;
    set((s) => {
      const merged = merge(s.threads[connectionId]?.messages ?? [], incoming);
      // A confirmed message replaces its optimistic bubble.
      const pending = { ...s.pending };
      incoming.forEach((m) => m.clientId && delete pending[m.clientId]);
      return {
        threads: { ...s.threads, [connectionId]: { messages: merged, lastId: merged.at(-1)?.id ?? 0 } },
        pending,
      };
    });
    // A new message from someone ends their typing indicator.
    if (incoming.some((m) => !m.mine)) get().clearTyping(connectionId);
  },

  addPending: (p) => set((s) => ({ pending: { ...s.pending, [p.clientId]: p } })),
  failPending: (clientId) =>
    set((s) => (s.pending[clientId] ? { pending: { ...s.pending, [clientId]: { ...s.pending[clientId], status: "failed" } } } : s)),
  retryPending: (clientId) =>
    set((s) => (s.pending[clientId] ? { pending: { ...s.pending, [clientId]: { ...s.pending[clientId], status: "sending" } } } : s)),

  setOtherReadAt: (connectionId, readAt) =>
    set((s) => ({ otherReadAt: { ...s.otherReadAt, [connectionId]: readAt } })),

  setTyping: (connectionId, userId) => {
    clearTimeout(typingTimers.get(connectionId));
    typingTimers.set(
      connectionId,
      setTimeout(() => get().clearTyping(connectionId), TYPING_TTL_MS),
    );
    set((s) => ({ typing: { ...s.typing, [connectionId]: { userId, until: Date.now() + TYPING_TTL_MS } } }));
  },
  clearTyping: (connectionId) => {
    clearTimeout(typingTimers.get(connectionId));
    set((s) => {
      if (!s.typing[connectionId]) return s;
      const typing = { ...s.typing };
      delete typing[connectionId];
      return { typing };
    });
  },

  removeThread: (connectionId, removedBy) => {
    clearTimeout(typingTimers.get(connectionId));
    set((s) => {
      const drop = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== connectionId));
      return {
        threads: drop(s.threads),
        otherReadAt: drop(s.otherReadAt),
        typing: drop(s.typing),
        pending: Object.fromEntries(Object.entries(s.pending).filter(([, p]) => p.connectionId !== connectionId)),
        removed: { ...s.removed, [connectionId]: removedBy },
      };
    });
  },
}));
