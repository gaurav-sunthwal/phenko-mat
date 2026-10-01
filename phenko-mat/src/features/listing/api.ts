import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import type { FeedItem, ItemStats } from "@/shared/dto";

/** One listing exactly as the feed serves it (the owner can always read their own). */
export const useItem = (id: string) =>
  useQuery({ queryKey: qk.item(id), queryFn: ({ signal }) => api.get<FeedItem>(`/api/items/${id}`, signal) });

/** Owner-only analytics for a listing. */
export const useItemStats = (id: string) =>
  useQuery({ queryKey: qk.itemStats(id), queryFn: ({ signal }) => api.get<ItemStats>(`/api/items/${id}/stats`, signal) });
