"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import type { ConnectionSummary, ItemStatus, Me, MyItem, PublicUser } from "@/lib/dto";
import { ApiRequestError, api } from "./api";
import { useUi } from "./stores/ui";

const MY_ITEMS = "/api/me/items";
const ME = "/api/me";
const CONNECTIONS = "/api/connections";
/** One chat's summary (not its messages). */
const isConnectionDetail = (key: string) => /^\/api\/connections\/[^/]+$/.test(key);

type Snapshot = [string, unknown][];

/**
 * Listing actions shared by the profile and the chat header. Like the app, every action updates the
 * screen at once (the row, profile stats and the item's status in chats) and rolls back with a
 * message if the server says no.
 */
export function useListingActions() {
  const { cache, mutate } = useSWRConfig();
  const showToast = useUi((s) => s.showToast);
  const setGivingItemId = useUi((s) => s.setGivingItemId);

  const snapshot = useCallback((): Snapshot => {
    const keys = [MY_ITEMS, ME, CONNECTIONS, ...[...cache.keys()].filter(isConnectionDetail)];
    return keys.map((k) => [k, cache.get(k)?.data]);
  }, [cache]);

  const restore = useCallback(
    (snap: Snapshot) => snap.forEach(([k, data]) => data !== undefined && mutate(k, data, { revalidate: false })),
    [mutate],
  );

  const patchChats = useCallback(
    (itemId: string, status: ItemStatus) => {
      const patch = (c: ConnectionSummary) => (c.item.id === itemId ? { ...c, item: { ...c.item, status } } : c);
      mutate<ConnectionSummary[]>(CONNECTIONS, (list) => list?.map(patch), { revalidate: false });
      [...cache.keys()]
        .filter(isConnectionDetail)
        .forEach((k) => mutate<ConnectionSummary>(k, (c) => (c ? patch(c) : c), { revalidate: false }));
    },
    [cache, mutate],
  );

  const refresh = useCallback(() => {
    mutate(MY_ITEMS);
    mutate(ME);
    mutate((key) => typeof key === "string" && (key === CONNECTIONS || isConnectionDetail(key)));
  }, [mutate]);

  const fail = useCallback(
    (title: string, e: unknown) => showToast(`${title}. ${e instanceof ApiRequestError ? e.message : "Please try again."}`),
    [showToast],
  );

  /** Mark as given / relist. */
  const setStatus = useCallback(
    async (id: string, status: "given" | "active", givenToId?: string | null) => {
      const snap = snapshot();
      const before = (cache.get(MY_ITEMS)?.data as MyItem[] | undefined)?.find((i) => i.id === id)?.status;
      mutate<MyItem[]>(MY_ITEMS, (items) => items?.map((i) => (i.id === id ? { ...i, status } : i)), { revalidate: false });
      if (before && before !== status) {
        const delta = status === "given" ? 1 : -1;
        mutate<Me>(ME, (me) => me && { ...me, stats: { ...me.stats, given: me.stats.given + delta } }, { revalidate: false });
      }
      patchChats(id, status);
      try {
        await api("PATCH", `/api/items/${id}`, status === "given" ? { status, givenToId: givenToId ?? null } : { status });
      } catch (e) {
        restore(snap);
        fail("Couldn't update the listing", e);
      } finally {
        refresh();
      }
    },
    [cache, fail, mutate, patchChats, refresh, restore, snapshot],
  );

  /** People who connected on one of my items (from the cached chats list), newest chat first. */
  const takersOf = useCallback(
    (itemId: string): PublicUser[] =>
      ((cache.get(CONNECTIONS)?.data as ConnectionSummary[] | undefined) ?? [])
        .filter((c) => c.role === "giver" && c.item.id === itemId)
        .map((c) => c.other),
    [cache],
  );

  /** Asks "Who got it?" when anyone connected on the item (so their "Received" count is right). */
  const markGiven = useCallback(
    (itemId: string) => {
      if (takersOf(itemId).length) setGivingItemId(itemId);
      else void setStatus(itemId, "given");
    },
    [setGivingItemId, setStatus, takersOf],
  );

  /** Removes a listing: the row disappears at once and comes back if the delete fails. */
  const remove = useCallback(
    async (id: string) => {
      const snap = snapshot();
      const removed = (cache.get(MY_ITEMS)?.data as MyItem[] | undefined)?.find((i) => i.id === id);
      mutate<MyItem[]>(MY_ITEMS, (items) => items?.filter((i) => i.id !== id), { revalidate: false });
      if (removed) {
        const wasGiven = removed.status === "given" ? 1 : 0;
        mutate<Me>(
          ME,
          (me) => me && { ...me, stats: { ...me.stats, listed: me.stats.listed - 1, given: me.stats.given - wasGiven } },
          { revalidate: false },
        );
      }
      patchChats(id, "removed");
      try {
        await api("DELETE", `/api/items/${id}`);
      } catch (e) {
        restore(snap);
        fail("Couldn't remove the listing", e);
      } finally {
        refresh();
      }
    },
    [cache, fail, mutate, patchChats, refresh, restore, snapshot],
  );

  return { setStatus, markGiven, remove, takersOf };
}
