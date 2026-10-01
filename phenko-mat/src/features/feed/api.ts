import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api, qs } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import type { FeedItem, SwipeResult } from "@/shared/dto";
import type { FeedScope } from "@/stores/ui";

/** Pass `scope: null` to wait (e.g. until we know whether the user has a location). */
export const useFeed = (categoryId: string | undefined, scope: FeedScope | null, q?: string, freeOnly = false) =>
  useQuery({
    queryKey: qk.feed.deck(scope ?? "all", categoryId, q, freeOnly),
    queryFn: ({ signal }) =>
      api.get<FeedItem[]>(`/api/feed${qs({ scope: scope ?? undefined, category: categoryId, q, free: freeOnly ? "1" : undefined })}`, signal),
    enabled: scope !== null,
    // The deck is consumed by swiping; refetching on focus would reshuffle cards under the thumb.
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    retry: false,
  });

export function useSwipeActions() {
  const client = useQueryClient();

  const swipe = useCallback(
    async (itemId: string, direction: "left" | "right") => {
      const res = await api.post<SwipeResult>("/api/swipes", { itemId, direction });
      if (res.connection) {
        // Seed the chat header so "Send a message" opens a fully rendered chat.
        client.setQueryData(qk.connections.detail(res.connection.id), res.connection);
        void client.invalidateQueries({ queryKey: qk.connections.all });
        void client.invalidateQueries({ queryKey: qk.likes });
      }
      return res;
    },
    [client],
  );

  const resetPasses = useCallback(
    async (categoryId?: string) => {
      await api.delete(`/api/swipes${qs({ category: categoryId })}`);
      await client.invalidateQueries({ queryKey: qk.feed.all });
    },
    [client],
  );

  /** Takes back one pass so the item can be swiped again. */
  const undoPass = useCallback((itemId: string) => api.delete(`/api/swipes/${itemId}`), []);

  return { swipe, resetPasses, undoPass };
}
