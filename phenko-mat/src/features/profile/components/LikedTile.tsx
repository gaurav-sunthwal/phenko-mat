import { Link } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Photo, Text } from "@/components/ui";
import type { LikedItem } from "@/shared/dto";
import { formatPrice } from "@/shared/format";
import { colors, radius } from "@/theme";

export const LikedTile = memo(function LikedTile({ like }: { like: LikedItem }) {
  const { connectionId, item, owner } = like;
  const taken = item.status !== "active";
  return (
    <Link href={{ pathname: "/chat/[id]", params: { id: connectionId } }} asChild>
      <Pressable style={styles.tile} accessibilityRole="link" accessibilityLabel={item.title}>
        <View style={styles.photo}>
          <Photo uri={item.photo} muted={taken} />
          {taken ? (
            <View style={styles.taken}>
              <Text weight="bold" size="xs1" color={colors.white}>
                Taken
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <Text weight="bold" size="sm" numberOfLines={1}>
            {item.title}
          </Text>
          <Text size="xs" color={colors.inkSoft} numberOfLines={1}>
            {formatPrice(item.priceInr)} · {owner.name.split(" ")[0]}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
});

const styles = StyleSheet.create({
  tile: { borderRadius: radius.card, overflow: "hidden", backgroundColor: colors.white },
  photo: { aspectRatio: 1 },
  taken: { position: "absolute", top: 8, left: 8, borderRadius: radius.full, backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 2 },
  body: { padding: 12 },
});
