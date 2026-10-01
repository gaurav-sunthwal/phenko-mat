import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform, type AppStateStatus } from "react-native";
import { ApiRequestError } from "@/lib/api/errors";

/*
 * Server state lives in React Query (the web uses SWR; same idea). Wiring it to React Native:
 * - "window focus" = the app coming back to the foreground,
 * - "online" = NetInfo reachability, so queries pause offline and refetch on reconnect.
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      // Retry transient failures only; a 4xx won't fix itself.
      retry: (count, error) =>
        count < 2 && !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
    },
    mutations: { retry: false },
  },
});

let wired = false;

export function wireQueryToNative() {
  if (wired) return;
  wired = true;

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false)),
  );

  if (Platform.OS !== "web") {
    AppState.addEventListener("change", (status: AppStateStatus) => focusManager.setFocused(status === "active"));
  }
}
