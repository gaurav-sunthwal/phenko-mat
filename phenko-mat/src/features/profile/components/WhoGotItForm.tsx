import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, Text } from "@/components/ui";
import { colors, radius } from "@/theme";
import { takersOf, useSetItemStatus } from "../api";

/** Picks which of the people who connected got the item; it counts toward their "Received". */
export function WhoGotItForm({ itemId }: { itemId: string }) {
  const client = useQueryClient();
  const [people] = useState(() => takersOf(client, itemId));
  const setStatus = useSetItemStatus();

  function choose(givenToId: string | null) {
    setStatus.mutate({ id: itemId, status: "given", givenToId });
    router.back();
  }

  return (
    <View style={styles.list}>
      <Text size="sm" color={colors.inkSoft} style={styles.hint}>
        It will show up in their “Received” count.
      </Text>
      {people.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => choose(p.id)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Given to ${p.name}`}
        >
          <Avatar user={p} size={40} />
          <Text weight="bold" numberOfLines={1} style={styles.flex}>
            {p.name}
          </Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => choose(null)}
        style={({ pressed }) => [styles.row, styles.other, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        <Text weight="bold" color={colors.inkSoft}>
          Someone else
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  hint: { marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.paper },
  other: { justifyContent: "center", backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  pressed: { backgroundColor: colors.cream },
  flex: { flex: 1 },
});
