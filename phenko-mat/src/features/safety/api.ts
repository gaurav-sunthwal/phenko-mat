import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { Alert } from "react-native";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { qk } from "@/lib/query/keys";
import type { ConnectionSummary, PublicUser } from "@/shared/dto";

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or fake" },
  { value: "scam", label: "Scam or asking for money" },
  { value: "prohibited", label: "Not allowed on Phenko Mat" },
  { value: "offensive", label: "Offensive or harassing" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export type ReportKind = "item" | "user";

export function sendReport(kind: ReportKind, id: string, reason: ReportReason, details: string) {
  const path = kind === "item" ? `/api/items/${id}/report` : `/api/users/${id}/report`;
  return api.post(path, { reason, ...(details.trim() && { details: details.trim() }) });
}

export const useBlocked = () =>
  useQuery({ queryKey: qk.blocks, queryFn: ({ signal }) => api.get<PublicUser[]>("/api/me/blocks", signal) });

/**
 * Blocking: asks first, then drops their chats from the list at once and refreshes everything they
 * appear in. Resolves to whether the block went through.
 */
export function useBlockUser() {
  const client = useQueryClient();
  return useCallback(
    (user: PublicUser) =>
      new Promise<boolean>((resolve) => {
        const first = user.name.split(" ")[0];
        Alert.alert(
          `Block ${first}?`,
          "You won't see each other's listings, your chats with them are deleted, and they can't message you. They won't be told.",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            {
              text: "Block",
              style: "destructive",
              onPress: async () => {
                try {
                  await api.post(`/api/users/${user.id}/block`);
                } catch (e) {
                  Alert.alert(`Couldn't block ${first}`, errorMessage(e, "Please try again."));
                  return resolve(false);
                }
                client.setQueryData<ConnectionSummary[]>(qk.connections.list, (list) => list?.filter((c) => c.other.id !== user.id));
                void client.invalidateQueries({ queryKey: qk.connections.all });
                void client.invalidateQueries({ queryKey: qk.likes });
                void client.invalidateQueries({ queryKey: qk.blocks });
                void client.invalidateQueries({ queryKey: qk.feed.all });
                resolve(true);
              },
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      }),
    [client],
  );
}

export function useUnblock() {
  const client = useQueryClient();
  return useCallback(
    async (id: string) => {
      client.setQueryData<PublicUser[]>(qk.blocks, (list) => list?.filter((u) => u.id !== id));
      await api.delete(`/api/users/${id}/block`).catch(() => undefined);
      void client.invalidateQueries({ queryKey: qk.blocks });
      void client.invalidateQueries({ queryKey: qk.feed.all });
    },
    [client],
  );
}
