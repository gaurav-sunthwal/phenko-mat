import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { alpha, colors, radius } from "@/theme";

/** Card-shaped placeholder so the layout doesn't jump while the first cards load (web: animate-pulse). */
export function DeckSkeleton() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(0.5, { duration: 900 }), -1, true));
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel="Finding things">
      <Animated.View style={[styles.card, pulseStyle]}>
        <View style={styles.lines}>
          <View style={[styles.line, { width: 80, height: 24, borderRadius: radius.full }]} />
          <View style={[styles.line, { width: "75%", height: 28 }]} />
          <View style={[styles.line, { width: "50%", height: 16, backgroundColor: alpha(colors.white, 0.6) }]} />
        </View>
      </Animated.View>
      <View style={styles.buttons}>
        <View style={[styles.circle, { width: 64, height: 64, backgroundColor: colors.white }]} />
        <View style={[styles.circle, { width: 76, height: 76, backgroundColor: colors.cream }]} />
      </View>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  card: { flex: 1, minHeight: 360, borderRadius: radius.sheet, backgroundColor: colors.line, overflow: "hidden" },
  lines: { position: "absolute", left: 20, right: 20, bottom: 24, gap: 12 },
  line: { borderRadius: radius.sm, backgroundColor: alpha(colors.white, 0.7) },
  buttons: { marginTop: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32 },
  circle: { borderRadius: 999 },
  spacer: { height: 28 },
});
