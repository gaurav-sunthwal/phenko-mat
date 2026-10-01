import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors, radius } from "@/theme";
import { Text } from "./Text";

export interface ChipProps {
  label: string;
  emoji?: string;
  selected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityHint?: string;
  disabled?: boolean;
  /** "honey" = profile interests, "ink" = new-listing categories, "dashed" = "+ New". */
  tone?: "honey" | "ink" | "dashed";
  leading?: ReactNode;
}

/** Toggle chip with a 2px border (web: `rounded-full border-2 px-3 py-1.5`). */
export function Chip({ label, emoji, selected, onPress, onLongPress, accessibilityHint, disabled, tone = "honey", leading }: ChipProps) {
  const on = selected && tone !== "dashed";
  const bg = on ? (tone === "ink" ? colors.ink : colors.honey) : tone === "dashed" ? "transparent" : colors.white;
  const border = on ? (tone === "ink" ? colors.ink : colors.honey) : colors.line;
  const fg = on && tone === "ink" ? colors.white : tone === "dashed" ? colors.inkSoft : colors.ink;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg, borderColor: border, borderStyle: tone === "dashed" ? "dashed" : "solid" },
        pressed && !on && { borderColor: colors.ink },
      ]}
    >
      {leading}
      <Text weight="semibold" size="sm" color={fg}>
        {emoji ? `${emoji} ` : ""}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
