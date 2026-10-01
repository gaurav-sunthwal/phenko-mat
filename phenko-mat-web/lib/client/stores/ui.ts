"use client";

import { create } from "zustand";
import type { PublicUser } from "@/lib/dto";

export type FeedScope = "nearby" | "all";

/**
 * The "It's a connection!" overlay opens the moment a card is swiped right, built from what the card
 * already knows. The swipe request fills in `connectionId` (needed to open the chat) or `error`.
 */
export interface PendingMatch {
  itemId: string;
  item: { title: string; photo: string; priceInr: number };
  other: PublicUser;
  connectionId: string | null;
  error: string | null;
}

interface UiState {
  /** The "It's a connection!" overlay. */
  match: PendingMatch | null;
  /** Feed scope the user picked this session (null = decide from whether they have a location). */
  feedScope: FeedScope | null;
  /** "Free only" feed filter, for this session. */
  freeOnly: boolean;
  /** Items swiped this session — hidden immediately in every deck while the server catches up. */
  swiped: Record<string, true>;
  /** Short message at the bottom of the screen (e.g. an optimistic action that had to be undone). */
  toast: string | null;
  /** Item whose "Who got it?" sheet is open. */
  givingItemId: string | null;
  showMatch: (m: PendingMatch | null) => void;
  /** Settles the swipe behind `itemId`; ignored if the user has already moved on to another match. */
  settleMatch: (itemId: string, result: { connectionId: string } | { error: string }) => void;
  setFeedScope: (s: FeedScope) => void;
  setFreeOnly: (on: boolean) => void;
  markSwiped: (itemId: string) => void;
  unmarkSwiped: (itemId: string) => void;
  clearSwiped: () => void;
  showToast: (message: string | null) => void;
  setGivingItemId: (itemId: string | null) => void;
}

export const useUi = create<UiState>()((set) => ({
  match: null,
  feedScope: null,
  freeOnly: false,
  swiped: {},
  toast: null,
  givingItemId: null,
  showMatch: (match) => set({ match }),
  settleMatch: (itemId, result) =>
    set((s) =>
      s.match?.itemId === itemId
        ? { match: { ...s.match, ...("error" in result ? { error: result.error } : { connectionId: result.connectionId }) } }
        : {},
    ),
  setFeedScope: (feedScope) => set({ feedScope }),
  setFreeOnly: (freeOnly) => set({ freeOnly }),
  markSwiped: (itemId) => set((s) => ({ swiped: { ...s.swiped, [itemId]: true } })),
  unmarkSwiped: (itemId) =>
    set((s) => ({ swiped: Object.fromEntries(Object.entries(s.swiped).filter(([id]) => id !== itemId)) })),
  clearSwiped: () => set({ swiped: {} }),
  showToast: (toast) => set({ toast }),
  setGivingItemId: (givingItemId) => set({ givingItemId }),
}));
