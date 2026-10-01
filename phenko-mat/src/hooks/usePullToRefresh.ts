import { useCallback, useState } from "react";

/**
 * Spinner state for a `RefreshControl` that only reflects user pulls. Feeding it a query's `isRefetching`
 * instead would pop the spinner (and push the list down) on every background poll or app-focus refetch.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refetch().finally(() => setRefreshing(false));
  }, [refetch]);
  return { refreshing, onRefresh };
}
