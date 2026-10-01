import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import type { ConnectionSummary, ItemStatus, LikedItem, Me, MyItem } from "@/shared/dto";

export type ProfilePatch = Partial<{
  name: string;
  bio: string;
  avatarUrl: string | null;
  location: { lat: number; lng: number; area: string };
  radiusKm: number;
  interests: string[];
}>;

export const meQuery = {
  queryKey: qk.me,
  queryFn: ({ signal }: { signal: AbortSignal }) => api.get<Me>("/api/me", signal),
};

export const useMe = () => useQuery(meQuery);

export const useMyItems = () =>
  useQuery({ queryKey: qk.myItems, queryFn: ({ signal }) => api.get<MyItem[]>("/api/me/items", signal) });

export const useLikes = () =>
  useQuery({ queryKey: qk.likes, queryFn: ({ signal }) => api.get<LikedItem[]>("/api/me/likes", signal) });

const UPDATE_ME = ["update-me"] as const;

/**
 * PATCH /api/me. Optimistic: the cache (and so the UI) takes the patch immediately and rolls back if the
 * request fails. Calls run one at a time (`scope`) so quick successive edits reach the server in order.
 */
export function useUpdateMe() {
  const client = useQueryClient();
  return useMutation({
    mutationKey: UPDATE_ME,
    scope: { id: "update-me" },
    mutationFn: (patch: ProfilePatch) => api.patch<Me>("/api/me", patch),
    onMutate: async (patch) => {
      await client.cancelQueries({ queryKey: qk.me });
      const previous = client.getQueryData<Me>(qk.me);
      if (previous) client.setQueryData<Me>(qk.me, applyProfilePatch(previous, patch));
      return { previous };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.previous) client.setQueryData(qk.me, ctx.previous);
    },
    onSuccess: (me, patch) => {
      // A later edit may already be queued; its optimistic state wins until it lands too.
      if (client.isMutating({ mutationKey: UPDATE_ME }) <= 1) client.setQueryData(qk.me, me);
      // Distance and taste ranking depend on these.
      if (patch.location || patch.radiusKm !== undefined || patch.interests) {
        void client.invalidateQueries({ queryKey: qk.feed.all });
      }
      if (patch.location || patch.radiusKm !== undefined) {
        void client.invalidateQueries({ queryKey: qk.categories });
      }
    },
  });
}

function applyProfilePatch(me: Me, { location, ...rest }: ProfilePatch): Me {
  return {
    ...me,
    ...rest,
    ...(location && { location: { lat: location.lat, lng: location.lng }, area: location.area }),
  };
}

type ItemSnapshot = [readonly unknown[], unknown][];

/** Snapshots every cached query that shows the user's own items, so an optimistic edit can be undone. */
function snapshotItemQueries(client: QueryClient): ItemSnapshot {
  return [
    ...client.getQueriesData({ queryKey: qk.myItems }),
    ...client.getQueriesData({ queryKey: qk.me }),
    ...client.getQueriesData({ queryKey: qk.connections.all }),
  ];
}

function restore(client: QueryClient, snapshot: ItemSnapshot | undefined) {
  snapshot?.forEach(([key, data]) => client.setQueryData(key, data));
}

/** Writes an item's new status into the chats list and every open chat header. */
function patchConnectionsItemStatus(client: QueryClient, itemId: string, status: ItemStatus) {
  const patch = (c: ConnectionSummary) => (c.item.id === itemId ? { ...c, item: { ...c.item, status } } : c);
  client.setQueryData<ConnectionSummary[]>(qk.connections.list, (list) => list?.map(patch));
  client.setQueriesData<ConnectionSummary>({ queryKey: [...qk.connections.all, "detail"] }, (c) => (c ? patch(c) : c));
}

function reportFailure(title: string, e: unknown) {
  Alert.alert(title, errorMessage(e, "Please try again."));
}

/** Mark as given / relist. Optimistic everywhere the item shows; rolls back with an alert on failure. */
export function useSetItemStatus() {
  const client = useQueryClient();
  return useMutation({
    scope: { id: "item-status" },
    mutationFn: ({ id, status, givenToId }: { id: string; status: "given" | "active"; givenToId?: string | null }) =>
      api.patch(`/api/items/${id}`, status === "given" ? { status, givenToId: givenToId ?? null } : { status }),
    onMutate: async ({ id, status }) => {
      await Promise.all([
        client.cancelQueries({ queryKey: qk.myItems }),
        client.cancelQueries({ queryKey: qk.me }),
        client.cancelQueries({ queryKey: qk.connections.all }),
      ]);
      const snapshot = snapshotItemQueries(client);
      const before = client.getQueryData<MyItem[]>(qk.myItems)?.find((i) => i.id === id)?.status;
      client.setQueryData<MyItem[]>(qk.myItems, (items) => items?.map((i) => (i.id === id ? { ...i, status } : i)));
      if (before && before !== status) {
        const delta = status === "given" ? 1 : -1;
        client.setQueryData<Me>(qk.me, (me) => me && { ...me, stats: { ...me.stats, given: me.stats.given + delta } });
      }
      patchConnectionsItemStatus(client, id, status);
      return { snapshot };
    },
    onError: (e, _vars, ctx) => {
      restore(client, ctx?.snapshot);
      reportFailure("Couldn't update the listing", e);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: qk.myItems });
      void client.invalidateQueries({ queryKey: qk.me });
      void client.invalidateQueries({ queryKey: qk.connections.all });
    },
  });
}

/** People who connected on one of my items (from the cached chats list), newest chat first. */
export function takersOf(client: QueryClient, itemId: string) {
  return (client.getQueryData<ConnectionSummary[]>(qk.connections.list) ?? [])
    .filter((c) => c.role === "giver" && c.item.id === itemId)
    .map((c) => c.other);
}

/**
 * "Mark as given": asks who got it when anyone connected on the item (so their "Received" count is right),
 * otherwise marks it straight away.
 */
export function useMarkGiven() {
  const client = useQueryClient();
  const setStatus = useSetItemStatus();
  return useCallback(
    (itemId: string) => {
      if (takersOf(client, itemId).length) router.push(`/give/${itemId}`);
      else setStatus.mutate({ id: itemId, status: "given" });
    },
    [client, setStatus],
  );
}

/** Removes a listing. The row disappears at once; it comes back with an alert if the delete fails. */
export function useDeleteItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/items/${id}`),
    onMutate: async (id) => {
      await Promise.all([
        client.cancelQueries({ queryKey: qk.myItems }),
        client.cancelQueries({ queryKey: qk.me }),
        client.cancelQueries({ queryKey: qk.connections.all }),
      ]);
      const snapshot = snapshotItemQueries(client);
      const removed = client.getQueryData<MyItem[]>(qk.myItems)?.find((i) => i.id === id);
      client.setQueryData<MyItem[]>(qk.myItems, (items) => items?.filter((i) => i.id !== id));
      if (removed) {
        const wasGiven = removed.status === "given";
        client.setQueryData<Me>(
          qk.me,
          (me) =>
            me && {
              ...me,
              stats: { ...me.stats, listed: me.stats.listed - 1, given: me.stats.given - (wasGiven ? 1 : 0) },
            },
        );
      }
      patchConnectionsItemStatus(client, id, "removed");
      return { snapshot };
    },
    onError: (e, _id, ctx) => {
      restore(client, ctx?.snapshot);
      reportFailure("Couldn't remove the listing", e);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: qk.myItems });
      void client.invalidateQueries({ queryKey: qk.me });
      void client.invalidateQueries({ queryKey: qk.connections.all });
    },
  });
}
