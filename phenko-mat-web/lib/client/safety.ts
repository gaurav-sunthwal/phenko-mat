"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import type { ConnectionSummary, PublicUser } from "@/lib/dto";
import { ApiRequestError, api } from "./api";
import { useUi } from "./stores/ui";

export const REPORT_REASONS = [
  { value: "spam", label: "Spam or fake" },
  { value: "scam", label: "Scam or asking for money" },
  { value: "prohibited", label: "Not allowed on Phenko Mat" },
  { value: "offensive", label: "Offensive or harassing" },
  { value: "other", label: "Something else" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
export type ReportTarget = { kind: "item"; id: string; title: string } | { kind: "user"; id: string; name: string };

export function sendReport(target: ReportTarget, reason: ReportReason, details: string) {
  const path = target.kind === "item" ? `/api/items/${target.id}/report` : `/api/users/${target.id}/report`;
  return api("POST", path, { reason, ...(details.trim() && { details: details.trim() }) });
}

/**
 * Blocking: asks first, then hides them everywhere at once (chats, feed) and tells the user. Returns
 * whether it went ahead.
 */
export function useBlockUser() {
  const { mutate } = useSWRConfig();
  const showToast = useUi((s) => s.showToast);

  return useCallback(
    async (user: PublicUser) => {
      const first = user.name.split(" ")[0];
      const ok = confirm(
        `Block ${first}? You won't see each other's listings, your chats with them are deleted, and they can't message you. They won't be told.`,
      );
      if (!ok) return false;
      try {
        await api("POST", `/api/users/${user.id}/block`);
      } catch (e) {
        showToast(`Couldn't block ${first}. ${e instanceof ApiRequestError ? e.message : "Please try again."}`);
        return false;
      }
      showToast(`${first} is blocked. You can unblock them from your profile.`);
      // Their chats are gone server-side: drop them from the list now rather than after the refetch.
      mutate<ConnectionSummary[]>("/api/connections", (list) => list?.filter((c) => c.other.id !== user.id), { revalidate: false });
      mutate("/api/connections");
      mutate("/api/me/likes");
      mutate("/api/me/blocks");
      mutate((key) => typeof key === "string" && key.startsWith("/api/feed"));
      return true;
    },
    [mutate, showToast],
  );
}
