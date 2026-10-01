import type { FeedScope } from "@/stores/ui";

/**
 * Every query key in one place. Hierarchical, so invalidating a prefix (e.g. `qk.feed.all`)
 * refreshes every variant under it.
 */
export const qk = {
  me: ["me"] as const,
  myItems: ["my-items"] as const,
  item: (id: string) => ["item", id] as const,
  itemStats: (id: string) => ["item", id, "stats"] as const,
  likes: ["likes"] as const,
  categories: ["categories"] as const,
  user: (id: string) => ["user", id] as const,
  blocks: ["blocks"] as const,
  feed: {
    all: ["feed"] as const,
    deck: (scope: FeedScope, categoryId: string | undefined, q?: string, freeOnly = false) =>
      ["feed", scope, categoryId ?? null, q ?? null, freeOnly] as const,
    /** Why a deck is empty (passed vs. wanted). Under `feed` so resetting passes refreshes it too. */
    summary: (categoryId: string | undefined, freeOnly: boolean) => ["feed", "summary", categoryId ?? null, freeOnly] as const,
  },
  connections: {
    all: ["connections"] as const,
    list: ["connections", "list"] as const,
    detail: (id: string) => ["connections", "detail", id] as const,
  },
};
