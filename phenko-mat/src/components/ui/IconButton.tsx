import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { colors, shadows } from "@/theme";
import { PressableScale } from "./PressableScale";

export interface IconButtonProps {
  icon: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  size?: number;
  background?: string;
  shadow?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Round icon-only button (back arrows, chat bubble, edit pencil…). */
export function IconButton({ icon, onPress, accessibilityLabel, size = 40, background = colors.white, shadow, disabled, style }: IconButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : 1,
        },
        shadow && shadows.sm,
        style,
      ]}
    >
      {icon}
    </PressableScale>
  );
}
