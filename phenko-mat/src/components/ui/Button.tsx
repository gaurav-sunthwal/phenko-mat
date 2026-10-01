import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts, radius } from "@/theme";
import { PressableScale } from "./PressableScale";
import { Text } from "./Text";

type Variant = "ink" | "honey" | "outline" | "white" | "cream";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  ink: { bg: colors.ink, fg: colors.white },
  honey: { bg: colors.honey, fg: colors.ink },
  outline: { bg: "transparent", fg: colors.ink, border: colors.ink },
  white: { bg: colors.white, fg: colors.ink, border: colors.ink },
  cream: { bg: colors.cream, fg: colors.ink },
};

const SIZES: Record<Size, { py: number; px: number; font: number; gap: number }> = {
  sm: { py: 6, px: 12, font: 12, gap: 4 },
  md: { py: 14, px: 20, font: 16, gap: 8 },
  lg: { py: 16, px: 24, font: 18, gap: 8 },
};

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  disabled?: boolean;
  /** Stretch to the parent's width (web: `w-full`). */
  block?: boolean;
  weight?: "bold" | "extrabold";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Pill button — every call-to-action in the app. */
export function Button({
  label,
  onPress,
  variant = "ink",
  size = "md",
  icon,
  disabled,
  block,
  weight = "bold",
  style,
  accessibilityLabel,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          paddingVertical: v.border ? s.py - 2 : s.py,
          paddingHorizontal: s.px,
          borderWidth: v.border ? 2 : 0,
          borderColor: v.border,
          gap: s.gap,
          opacity: disabled ? 0.55 : 1,
        },
        block && styles.block,
        style,
      ]}
    >
      {icon ? <View>{icon}</View> : null}
      <Text style={{ fontFamily: fonts[weight] }} size={s.font} color={v.fg} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.full,
    alignSelf: "center",
  },
  block: { alignSelf: "stretch" },
});
