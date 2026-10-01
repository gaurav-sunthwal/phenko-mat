import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import { ChatScreen } from "@/features/chat/ChatScreen";
import type { ConnectionSummary } from "@/shared/dto";
import { useUi } from "@/stores/ui";

export default function ChatRoute() {
  const { id, item } = useLocalSearchParams<{ id: string; item?: string }>();
  // Opened from a match: stays on PendingChat even after the real id is set, so the screen never remounts.
  if (item) return <PendingChat key={item} itemId={item} routeId={id} />;
  // Keyed so switching conversations never shows the previous thread's state.
  return <ChatScreen key={id} id={id} />;
}

/**
 * The chat opened from "Send a message" on the match screen, before the swipe request has returned the
 * connection id. Shows the header from the match right away, then swaps in the real id without remounting.
 */
function PendingChat({ itemId, routeId }: { itemId: string; routeId: string }) {
  const match = useUi((s) => (s.match?.itemId === itemId ? s.match : null));
  const connectionId = match?.connectionId ?? (routeId === "new" ? null : routeId);

  useEffect(() => {
    // Record the real id in the route so a restored navigation state lands on the actual chat.
    if (connectionId && routeId === "new") router.setParams({ id: connectionId });
  }, [connectionId, routeId]);

  const preview = useMemo<ConnectionSummary | undefined>(
    () =>
      match
        ? {
            id: "",
            role: "taker",
            item: { id: itemId, title: match.item.title, photo: match.item.photo, priceInr: match.item.priceInr, status: "active" },
            other: match.other,
            lastMessage: null,
            unread: 0,
            otherReadAt: new Date(0).toISOString(),
            createdAt: new Date().toISOString(),
          }
        : undefined,
    [match, itemId],
  );

  // While the swipe request is still creating the chat, the match is there without an id: show the chat
  // (connecting) rather than an error. Only a failed swipe, or no match at all (e.g. restored after a
  // restart), means there's no chat to show.
  const pendingError = match ? match.error : connectionId ? null : "This chat is no longer available.";
  return <ChatScreen id={connectionId} preview={preview} pendingError={pendingError} />;
}
