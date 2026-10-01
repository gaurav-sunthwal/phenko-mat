import { router } from "expo-router";
import { memo } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Button, Photo, Text, TrashIcon } from "@/components/ui";
import type { MyItem } from "@/shared/dto";
import { formatPrice } from "@/shared/format";
import { colors, radius } from "@/theme";
import { useDeleteItem, useMarkGiven, useSetItemStatus } from "../api";

export const ListingRow = memo(function ListingRow({ item }: { item: MyItem }) {
  const setStatus = useSetItemStatus();
  const markGiven = useMarkGiven();
  const remove = useDeleteItem();
  const live = item.status === "active";
  // Both mutations are optimistic, so the row never waits on the network; only block a double delete.
  const busy = remove.isPending;

  function confirmRemove() {
    Alert.alert("Remove this listing?", "People you're chatting with will see it's no longer available.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => remove.mutate(item.id) },
    ]);
  }

  return (
    <Pressable
      onPress={() => router.push(`/listing/${item.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Preview ${item.title}`}
    >
      <View style={styles.photo}>
        <Photo uri={item.photos[0]} accessibilityLabel={item.title} />
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <Text weight="bold" numberOfLines={1} style={styles.flexShrink}>
            {item.title}
          </Text>
          <View style={[styles.status, { backgroundColor: live ? colors.successSoft : colors.line }]}>
            <Text weight="extrabold" size="xs1" color={live ? colors.success : colors.inkSoft}>
              {live ? "LIVE" : "GIVEN"}
            </Text>
          </View>
        </View>
        <Text size="sm" color={colors.inkSoft}>
          {formatPrice(item.priceInr)} · {item.viewCount} {item.viewCount === 1 ? "view" : "views"} · {item.connectionCount}{" "}
          {item.connectionCount === 1 ? "person wants it" : "people want it"}
        </Text>
        <View style={styles.actions}>
          {live ? (
            <Button size="sm" label="Mark as given" onPress={() => markGiven(item.id)} style={styles.left} />
          ) : (
            <Button size="sm" variant="outline" label="Relist" onPress={() => setStatus.mutate({ id: item.id, status: "active" })} style={styles.left} />
          )}
          <Pressable
            onPress={confirmRemove}
            disabled={busy}
            style={({ pressed }) => [styles.trash, pressed && { backgroundColor: colors.dangerSoft }]}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.title}`}
          >
            {({ pressed }) => <TrashIcon size={16} color={pressed ? colors.danger : colors.inkSoft} />}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, borderRadius: radius.card, backgroundColor: colors.white, padding: 12, marginHorizontal: 16 },
  pressed: { opacity: 0.85 },
  photo: { width: 80, height: 80, borderRadius: radius.lg, overflow: "hidden" },
  body: { flex: 1, minWidth: 0 },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  flexShrink: { flexShrink: 1 },
  status: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 8 },
  left: { alignSelf: "flex-start" },
  trash: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
