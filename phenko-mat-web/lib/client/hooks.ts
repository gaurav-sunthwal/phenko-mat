"use client";

import useSWR, { preload } from "swr";
import type { Category, ConnectionSummary, FeedItem, ItemStats, LikedItem, Me, MyItem, PublicProfile, PublicUser } from "@/lib/dto";
import { DEFAULT_CATEGORIES } from "@/lib/catalog";
import { fetcher } from "./api";
import type { FeedScope } from "./stores/ui";

const builtInOrder = new Map(DEFAULT_CATEGORIES.map((c, i) => [c.id, i]));

export const useMe = () => useSWR<Me>("/api/me", fetcher);

async function categoriesFetcher(url: string) {
  const list = await fetcher<Category[]>(url);
  return list.sort((a, b) => (builtInOrder.get(a.id) ?? 99) - (builtInOrder.get(b.id) ?? 99));
}

export const useCategories = () => useSWR<Category[]>("/api/categories", categoriesFetcher);

/** Warm the cache for every tab as soon as the app shell loads, so switching tabs is instant. */
export function preloadAppData() {
  preload("/api/me", fetcher);
  preload("/api/categories", categoriesFetcher);
  preload("/api/connections", fetcher);
}

function feedKey(categoryId: string | undefined, scope: FeedScope, q: string | undefined, freeOnly: boolean) {
  const qs = new URLSearchParams({ scope });
  if (categoryId) qs.set("category", categoryId);
  if (q) qs.set("q", q);
  if (freeOnly) qs.set("free", "1");
  return `/api/feed?${qs}`;
}

/** Pass `scope: null` to wait (e.g. until we know whether the user has a location). `q`: search results. */
export const useFeed = (categoryId: string | undefined, scope: FeedScope | null, q?: string, freeOnly = false) =>
  useSWR<FeedItem[]>(scope ? feedKey(categoryId, scope, q, freeOnly) : null, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

// Live updates arrive over the WebSocket (which revalidates this key); the interval is only a safety net.
export const useConnections = () =>
  useSWR<ConnectionSummary[]>("/api/connections", fetcher, { refreshInterval: 60_000 });

/** Seeds from the chats list we already have, so the chat header renders instantly. */
export function useConnection(id: string) {
  const { data: list } = useSWR<ConnectionSummary[]>("/api/connections", null);
  return useSWR<ConnectionSummary>(`/api/connections/${id}`, fetcher, {
    fallbackData: list?.find((c) => c.id === id),
  });
}

/** One listing exactly as the feed serves it (the owner can always read their own). */
export const useItem = (id: string) => useSWR<FeedItem>(`/api/items/${id}`, fetcher);

export const useMyItems = () => useSWR<MyItem[]>("/api/me/items", fetcher);
export const useLikes = () => useSWR<LikedItem[]>("/api/me/likes", fetcher);

// No retries: a deleted or blocked profile is a 404 that won't change by asking again.
export const usePublicProfile = (id: string) =>
  useSWR<PublicProfile>(`/api/users/${id}`, fetcher, { shouldRetryOnError: false });

/** Views, swipes, chats and reports for one of my listings (the Insights tab). */
export const useItemStats = (id: string, enabled = true) =>
  useSWR<ItemStats>(enabled ? `/api/items/${id}/stats` : null, fetcher);
export const useBlocked = () => useSWR<PublicUser[]>("/api/me/blocks", fetcher);
