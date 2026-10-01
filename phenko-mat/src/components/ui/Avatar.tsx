import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { initials } from "@/shared/format";
import { colors } from "@/theme";
import { Photo } from "./Photo";
import { Text } from "./Text";

export interface AvatarProps {
  user?: { name: string; avatarUrl: string | null } | null;
  size?: number;
  /** White ring (web: `ring-4 ring-white`). */
  ring?: boolean;
}

function tintFor(name: string) {
  const sum = [...name].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  return colors.avatarTints[sum % colors.avatarTints.length];
}

export const Avatar = memo(function Avatar({ user, size = 40, ring = false }: AvatarProps) {
  const name = user?.name ?? "?";
  const ringWidth = ring ? Math.max(2, Math.round(size / 16)) : 0;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tintFor(name),
          borderWidth: ringWidth,
          borderColor: colors.white,
        },
      ]}
    >
      {user?.avatarUrl ? (
        <Photo uri={user.avatarUrl} style={{ borderRadius: size / 2 }} />
      ) : (
        <Text weight="bold" size={size * 0.38}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
