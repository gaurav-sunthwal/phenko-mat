import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Avatar, IconButton, PencilIcon, PinIcon, Text } from "@/components/ui";
import type { Me } from "@/shared/dto";
import { alpha, colors, radius } from "@/theme";

/** Honey card with avatar, area, bio and stats. */
export function ProfileHeader({ me }: { me: Me }) {
  const stats = [
    ["Passed on", me.stats.given],
    ["Received", me.stats.got],
    ["Connections", me.stats.connections],
  ] as const;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Avatar user={me} size={76} ring />
        <View style={styles.flex}>
          <Text weight="black" size="2xl" numberOfLines={1} accessibilityRole="header">
            {me.name}
          </Text>
          <Pressable onPress={() => router.push("/location")} style={styles.area} accessibilityRole="button" hitSlop={6}>
            <PinIcon size={14} />
            <Text weight="semibold" size="sm" numberOfLines={1} style={styles.flexShrink}>
              {me.area ?? "Set your location"} · {me.radiusKm} km
            </Text>
          </Pressable>
        </View>
        <IconButton
          icon={<PencilIcon size={17} color={colors.white} />}
          background={colors.ink}
          accessibilityLabel="Edit profile"
          onPress={() => router.push("/edit-profile")}
        />
      </View>
      {me.bio ? (
        <Text size="sm" leading={1.6} style={styles.bio}>
          {me.bio}
        </Text>
      ) : null}
      <View style={styles.stats}>
        {stats.map(([label, value]) => (
          <View key={label} style={styles.stat} accessibilityLabel={`${label}: ${value}`}>
            <Text weight="black" size="xl">
              {value}
            </Text>
            <Text weight="semibold" size="xs">
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 8, borderRadius: radius.sheet, backgroundColor: colors.honey, padding: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1 },
  area: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  bio: { marginTop: 16 },
  stats: { flexDirection: "row", gap: 8, marginTop: 20 },
  stat: { flex: 1, alignItems: "center", borderRadius: radius.lg, backgroundColor: alpha(colors.white, 0.6), paddingVertical: 10 },
});
