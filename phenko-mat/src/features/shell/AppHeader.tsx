import { Link, router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatIcon, LogoMark, PlusIcon, PressableScale, Text } from "@/components/ui";
import { useUnreadCount } from "@/features/connections/api";
import { alpha, colors, radius, shadows } from "@/theme";

/** Web: <AppHeader> — logo mark, "List item" and chats with an unread badge. */
export function AppHeader() {
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Link href="/feed" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Home" hitSlop={8}>
          <LogoMark size={40} />
        </Pressable>
      </Link>
      <View style={styles.actions}>
        <PressableScale onPress={() => router.push("/new")} style={styles.listButton} accessibilityLabel="List item">
          <PlusIcon size={18} strokeWidth={2.6} color={colors.white} />
          <Text weight="bold" size="sm" color={colors.white}>
            List item
          </Text>
        </PressableScale>
        <PressableScale
          onPress={() => router.push("/chats")}
          style={styles.chatButton}
          accessibilityLabel={unread ? `Chats, ${unread} unread` : "Chats"}
        >
          <ChatIcon size={21} />
          {unread > 0 ? (
            <View style={styles.badge}>
              <Text weight="extrabold" size="xs1">
                {unread > 9 ? "9+" : unread}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: alpha(colors.paper, 0.97),
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  listButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.ink,
    borderRadius: radius.full,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 16,
  },
  chatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.sm,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.honey,
    borderWidth: 2,
    borderColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
});
