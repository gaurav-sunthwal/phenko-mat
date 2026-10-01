import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api/client";
import { qk } from "@/lib/query/keys";
import { DEFAULT_CATEGORIES } from "@/shared/catalog";
import type { Category } from "@/shared/dto";

const builtInOrder = new Map(DEFAULT_CATEGORIES.map((c, i) => [c.id, i]));

async function fetchCategories(signal: AbortSignal) {
  const list = await api.get<Category[]>("/api/categories", signal);
  return list.sort((a, b) => (builtInOrder.get(a.id) ?? 99) - (builtInOrder.get(b.id) ?? 99));
}

export const categoriesQuery = {
  queryKey: qk.categories,
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchCategories(signal),
  staleTime: 5 * 60_000,
};

export const useCategories = () => useQuery(categoriesQuery);

/** id → category, for rendering pills on cards. */
export function useCategoryMap() {
  const { data } = useCategories();
  return useMemo(() => new Map((data ?? []).map((c) => [c.id, c])), [data]);
}

export function useCreateCategory() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; emoji: string }) => api.post<Category>("/api/categories", input),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.categories }),
  });
}
