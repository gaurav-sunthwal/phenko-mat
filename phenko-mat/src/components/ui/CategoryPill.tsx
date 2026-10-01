import { memo } from "react";
import { StyleSheet, View } from "react-native";
import type { Category } from "@/shared/dto";
import { alpha, colors, radius } from "@/theme";
import { Text } from "./Text";

export interface CategoryPillProps {
  category: Pick<Category, "id" | "name" | "emoji">;
  /** "glass" sits on top of photos. */
  tone?: "light" | "glass";
}

export const CategoryPill = memo(function CategoryPill({ category, tone = "light" }: CategoryPillProps) {
  const [bg, fg] =
    tone === "glass"
      ? [alpha(colors.white, 0.2), colors.white]
      : category.id === "premium"
        ? [colors.ink, colors.honey]
        : [colors.cream, colors.ink];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text weight="semibold" size="xs" color={fg}>
        {category.emoji} {category.name}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
});
