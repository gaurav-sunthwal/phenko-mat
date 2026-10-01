"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import type { ConnectionSummary } from "@/lib/dto";
import { ApiRequestError, api } from "./api";
import { dropConnection } from "./realtime";
import { useUi } from "./stores/ui";

/**
 * Deletes a chat for both people. Like the app: the chat leaves the list at once and the request runs
 * in the background; if it fails the chat comes back with a message. A 404 means the other person
 * deleted it first, which is the same outcome.
 */
export function useDeleteChat() {
  const { cache, mutate } = useSWRConfig();
  const showToast = useUi((s) => s.showToast);

  return useCallback(
    (connection: Pick<ConnectionSummary, "id" | "other">) => {
      const name = connection.other.name.split(" ")[0];
      if (!confirm(`Delete this chat? ${name} will be disconnected and all messages are deleted for both of you.`)) {
        return false;
      }
      const previous = cache.get("/api/connections")?.data as ConnectionSummary[] | undefined;
      dropConnection(connection.id);
      api("DELETE", `/api/connections/${connection.id}`)
        .catch((e: unknown) => {
          if (e instanceof ApiRequestError && e.status === 404) return;
          if (previous) mutate("/api/connections", previous, { revalidate: false });
          showToast(`Couldn't delete the chat. ${e instanceof ApiRequestError ? e.message : "Please try again."}`);
        })
        .finally(() => {
          mutate("/api/connections");
          mutate("/api/me/items");
          mutate("/api/me/likes");
          mutate("/api/me");
        });
      return true;
    },
    [cache, mutate, showToast],
  );
}
