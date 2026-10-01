import { FlashList } from "@shopify/flash-list";
import { Link, router } from "expo-router";
import { memo, useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Avatar, Button, EmptyState, ErrorNote, Photo, Spinner, Text } from "@/components/ui";
import { useNow } from "@/hooks/useNow";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { errorMessage } from "@/lib/api/errors";
import type { ConnectionSummary } from "@/shared/dto";
import { timeAgo } from "@/shared/format";
import { colors, radius } from "@/theme";
import { confirmDeleteConnection, useConnections, useDeleteConnection } from "./api";

const firstName = (name: string) => name.split(" ")[0];

/** Web: /chats. New connections as bubbles on top, active conversations below. */
export function ChatsScreen() {
  const { data, error, isLoading, refetch } = useConnections();
  const { refreshing, onRefresh } = usePullToRefresh(refetch);
  const deleteChat = useDeleteConnection();

  const { fresh, active } = useMemo(
    () => ({ fresh: (data ?? []).filter((c) => !c.lastMessage), active: (data ?? []).filter((c) => c.lastMessage) }),
    [data],
  );

  if (error) return <ErrorNote message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (isLoading || !data) return <Spinner />;
  if (data.length === 0) {
    return (
      <EmptyState
        emoji="💬"
        title="No connections yet"
        body="Swipe right on something you'd like, and you'll be able to chat with the person giving it away."
        action={<Button label="Start swiping" onPress={() => router.navigate("/feed")} />}
      />
    );
  }

  return (
    <FlashList
      data={active}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.honeyDeep} />}
      ListHeaderComponent={
        <View>
          <Text weight="black" size="3xl" style={styles.title} accessibilityRole="header">
            Connections
          </Text>
          {fresh.length > 0 ? (
            <View style={styles.section}>
              <Text weight="bold" size="sm" color={colors.inkSoft} style={styles.sectionTitle}>
                New — make the first move
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.freshRow}>
                {fresh.map((c) => (
                  <Link key={c.id} href={{ pathname: "/chat/[id]", params: { id: c.id } }} asChild>
                    <Pressable
                      onLongPress={() => confirmDeleteConnection(c.other.name, () => deleteChat.mutate(c.id))}
                      style={styles.freshItem}
                      accessibilityRole="link"
                      accessibilityLabel={`Chat with ${c.other.name}`}
                      accessibilityHint="Long press to delete this chat"
                    >
                      <View style={styles.freshPhoto}>
                        <Photo uri={c.item.photo} accessibilityLabel={c.item.title} />
                      </View>
                      <Text weight="bold" size="xs" numberOfLines={1}>
                        {firstName(c.other.name)}
                      </Text>
                    </Pressable>
                  </Link>
                ))}
              </ScrollView>
            </View>
          ) : null}
          {active.length > 0 ? (
            <Text weight="bold" size="sm" color={colors.inkSoft} style={[styles.sectionTitle, styles.section]}>
              Chats
            </Text>
          ) : null}
        </View>
      }
      renderItem={({ item }) => <ChatRow c={item} />}
    />
  );
}

const ChatRow = memo(function ChatRow({ c }: { c: ConnectionSummary }) {
  const now = useNow();
  const deleteChat = useDeleteConnection();
  const last = c.lastMessage!;
  return (
    // Not <Link asChild>: its Slot drops function styles, which collapsed the row layout.
    <Pressable
      onPress={() => router.push({ pathname: "/chat/[id]", params: { id: c.id } })}
      onLongPress={() => confirmDeleteConnection(c.other.name, () => deleteChat.mutate(c.id))}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="link"
      accessibilityHint="Long press to delete this chat"
    >
      <View>
        <View style={styles.rowPhoto}>
          <Photo uri={c.item.photo} />
        </View>
        <View style={styles.rowAvatar}>
          <Avatar user={c.other} size={26} ring />
        </View>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text weight="bold" numberOfLines={1} style={styles.flexShrink}>
            {c.other.name}
          </Text>
          <Text size="xs" color={colors.inkSoft}>
            {timeAgo(last.createdAt, now)}
          </Text>
        </View>
        <Text weight="semibold" size="xs" color={colors.inkSoft} numberOfLines={1}>
          {c.role === "giver" ? "Wants your" : "Giving"} {c.item.title}
        </Text>
        <Text size="sm" weight={c.unread ? "bold" : "regular"} color={c.unread ? colors.ink : colors.inkSoft} numberOfLines={1}>
          {last.mine ? "You: " : ""}
          {last.body}
        </Text>
      </View>
      {c.unread > 0 ? (
        <View style={styles.unread}>
          <Text weight="extrabold" size="xs">
            {c.unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  title: { paddingHorizontal: 16, paddingTop: 8 },
  section: { marginTop: 16 },
  sectionTitle: { paddingHorizontal: 16, marginBottom: 12 },
  freshRow: { gap: 16, paddingHorizontal: 16, paddingBottom: 8 },
  freshItem: { width: 80, alignItems: "center", gap: 6 },
  freshPhoto: { width: 80, height: 80, borderRadius: 40, overflow: "hidden", borderWidth: 4, borderColor: colors.honey },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowPressed: { backgroundColor: colors.white },
  rowPhoto: { width: 56, height: 56, borderRadius: radius.lg, overflow: "hidden" },
  rowAvatar: { position: "absolute", right: -6, bottom: -6 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  flexShrink: { flexShrink: 1 },
  unread: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: colors.honey,
    alignItems: "center",
    justifyContent: "center",
  },
});
