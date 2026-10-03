import { create } from "zustand";
import type { PublicUser } from "@/shared/dto";

export type FeedScope = "nearby" | "all";

/**
 * The "It's a connection!" screen opens the moment a card is swiped right, built from what the card already
 * knows. The swipe request fills in `connectionId` (needed to open the chat) or `error` when it lands.
 */
export interface PendingMatch {
  itemId: string;
  item: { title: string; photo: string; priceInr: number };
  other: PublicUser;
  connectionId: string | null;
  error: string | null;
}

interface UiState {
  /** Connection behind the "It's a connection!" screen. */
  match: PendingMatch | null;
  /** Feed scope the user picked this session (null = decide from whether they have a location). */
  feedScope: FeedScope | null;
  /** Items swiped this session — hidden immediately in every deck while the server catches up. */
  swiped: Record<string, true>;
  setMatch: (m: PendingMatch | null) => void;
  /** Settles the swipe behind `itemId`; ignored if the user has already moved on to another match. */
  settleMatch: (itemId: string, result: { connectionId: string } | { error: string }) => void;
  setFeedScope: (s: FeedScope) => void;
  markSwiped: (itemId: string) => void;
  unmarkSwiped: (itemId: string) => void;
  clearSwiped: () => void;
  reset: () => void;
}

const initial = { match: null, feedScope: null, swiped: {} };

export const useUi = create<UiState>()((set) => ({
  ...initial,
  setMatch: (match) => set({ match }),
  settleMatch: (itemId, result) =>
    set((s) =>
      s.match?.itemId === itemId
        ? { match: { ...s.match, ...("error" in result ? { error: result.error } : { connectionId: result.connectionId }) } }
        : {},
    ),
  setFeedScope: (feedScope) => set({ feedScope }),
  markSwiped: (itemId) => set((s) => ({ swiped: { ...s.swiped, [itemId]: true } })),
  unmarkSwiped: (itemId) =>
    set((s) => {
      const { [itemId]: _, ...rest } = s.swiped;
      return { swiped: rest };
    }),
  clearSwiped: () => set({ swiped: {} }),
  reset: () => set(initial),
}));
