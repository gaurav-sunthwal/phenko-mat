import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";
import { api } from "@/lib/api/client";
import { ApiRequestError, errorMessage } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import type { ConnectionSummary } from "@/shared/dto";

// Live updates arrive over the WebSocket (which invalidates this key); the interval is only a safety net.
export const connectionsQuery = {
  queryKey: qk.connections.list,
  queryFn: ({ signal }: { signal: AbortSignal }) => api.get<ConnectionSummary[]>("/api/connections", signal),
  refetchInterval: 60_000,
};

export const useConnections = () => useQuery(connectionsQuery);

export const useUnreadCount = () =>
  useQuery({ ...connectionsQuery, select: (list) => list.reduce((n, c) => n + c.unread, 0) }).data ?? 0;

/**
 * Seeds from the chats list we already have, so the chat header renders instantly. `id` is null for a chat
 * opened straight from a new match while the server is still creating it; `preview` stands in until then.
 */
export function useConnection(id: string | null, preview?: ConnectionSummary) {
  const client = useQueryClient();
  return useQuery<ConnectionSummary>({
    queryKey: qk.connections.detail(id ?? "pending"),
    queryFn: ({ signal }) => api.get<ConnectionSummary>(`/api/connections/${id}`, signal),
    enabled: id !== null,
    placeholderData: () => client.getQueryData<ConnectionSummary[]>(qk.connections.list)?.find((c) => c.id === id) ?? preview,
  });
}

/** Asks before deleting a chat; `onDelete` runs only if the user confirms. */
export function confirmDeleteConnection(otherName: string, onDelete: () => void) {
  Alert.alert(
    "Delete this chat?",
    `${otherName.split(" ")[0]} will be disconnected and all messages are deleted for both of you.`,
    [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ],
  );
}

/**
 * Deletes a chat for both people. The row disappears at once and comes back with an alert if the delete
 * fails; the other person's app drops it live via the `connection.removed` socket event.
 */
export function useDeleteConnection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/connections/${id}`).catch((e: unknown) => {
        // 404: the other person deleted it first — same outcome.
        if (!(e instanceof ApiRequestError && e.status === 404)) throw e;
      }),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: qk.connections.list });
      const previous = client.getQueryData<ConnectionSummary[]>(qk.connections.list);
      client.setQueryData<ConnectionSummary[]>(qk.connections.list, (list) => list?.filter((c) => c.id !== id));
      return { previous };
    },
    onError: (e, _id, ctx) => {
      if (ctx?.previous) client.setQueryData(qk.connections.list, ctx.previous);
      Alert.alert("Couldn't delete the chat", errorMessage(e, "Please try again."));
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: qk.connections.list });
      // Connection counts on listings and the profile, and the "liked" grid, are all derived from chats.
      void client.invalidateQueries({ queryKey: qk.myItems });
      void client.invalidateQueries({ queryKey: qk.likes });
      void client.invalidateQueries({ queryKey: qk.me });
    },
  });
}
