import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { ClockIcon, Text } from "@/components/ui";
import { alpha, colors, radius } from "@/theme";

export type BubbleStatus = "sending" | "sent" | "read" | "failed";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function Ticks({ status }: { status: BubbleStatus }) {
  if (status === "sending") return <ClockIcon size={13} strokeWidth={2.4} color={alpha(colors.ink, 0.6)} />;
  if (status === "failed") {
    return (
      <Text weight="bold" size="xs1" color={colors.danger} accessibilityLabel="Not sent">
        !
      </Text>
    );
  }
  const read = status === "read";
  return (
    <Svg width={18} height={12} viewBox="0 0 28 16" fill="none" stroke={read ? colors.readTick : alpha(colors.ink, 0.6)} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" accessibilityLabel={read ? "Read" : "Sent"}>
      <Path d="M1.5 8.5 6 13 15 3" />
      {read ? <Path d="M11 13 20 3" /> : null}
    </Svg>
  );
}

export const Bubble = memo(function Bubble({ mine, body, time, status }: { mine: boolean; body: string; time: string; status?: BubbleStatus }) {
  const bg = mine ? (status === "failed" ? colors.dangerSoft : status === "sending" ? alpha(colors.honey, 0.7) : colors.honey) : colors.white;
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs, { backgroundColor: bg }]}>
      <Text selectable>{body}</Text>
      <View style={styles.meta}>
        <Text size="xs1" color={mine ? alpha(colors.ink, 0.6) : colors.inkSoft}>
          {timeFormat.format(new Date(time))}
        </Text>
        {mine && status ? <Ticks status={status} /> : null}
      </View>
    </View>
  );
});

function Dot({ delay }: { delay: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.set(withDelay(delay, withRepeat(withSequence(withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 })), -1)));
  }, [delay, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

export function TypingDots({ name }: { name: string }) {
  return (
    <View style={[styles.bubble, styles.theirs, styles.typing]} accessibilityLabel={`${name} is typing`}>
      {[0, 150, 300].map((d) => (
        <Dot key={d} delay={d} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "78%", borderRadius: radius.tile, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  mine: { alignSelf: "flex-end", borderBottomRightRadius: 6 },
  theirs: { alignSelf: "flex-start", borderBottomLeftRadius: 6 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 2 },
  typing: { flexDirection: "row", gap: 4, backgroundColor: colors.white, paddingVertical: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.inkSoft },
});
