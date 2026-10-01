import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { motion } from "@/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed (web: `active:scale-95`). */
  activeScale?: number;
}

const EASE_OUT = Easing.out(Easing.cubic);

/** Pressable with a smooth press-down, run on the UI thread. */
export function PressableScale({ activeScale = motion.pressScale, style, onPressIn, onPressOut, disabled, ...rest }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withTiming(activeScale, { duration: motion.pressInMs, easing: EASE_OUT }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, { duration: motion.pressOutMs, easing: EASE_OUT }));
        onPressOut?.(e);
      }}
      style={[style, animated]}
      {...rest}
    />
  );
}
