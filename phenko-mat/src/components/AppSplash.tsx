import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Text } from "@/components/ui";
import { colors } from "@/theme";

/** Must match the expo-splash-screen plugin in app.config.ts, so the hand-off from the native splash is seamless. */
const NATIVE_MARK_SIZE = 112;
/** Long enough to read the name, short enough not to be in the way. */
const MIN_VISIBLE_MS = 1100;
const EXIT_MS = 320;

/**
 * Branded splash: picks up exactly where the native splash (honey + mark) leaves off, lifts the mark,
 * shows the name and tagline, then fades into the app once `ready`.
 */
export function AppSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const [minElapsed, setMinElapsed] = useState(false);
  const intro = useSharedValue(0);
  const words = useSharedValue(0);
  const exit = useSharedValue(1);

  useEffect(() => {
    intro.set(reduceMotion ? 1 : withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    words.set(reduceMotion ? 1 : withDelay(150, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) })));
    const t = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, [intro, words, reduceMotion]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    exit.set(
      withTiming(0, { duration: EXIT_MS, easing: Easing.out(Easing.quad) }, (done) => {
        if (done) scheduleOnRN(onDone);
      }),
    );
  }, [ready, minElapsed, exit, onDone]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: exit.get(),
    transform: [{ scale: 1 + (1 - exit.get()) * 0.06 }],
  }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: intro.get() * -40 }, { scale: 1 + intro.get() * 0.1 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: words.get(),
    transform: [{ translateY: (1 - words.get()) * 16 }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      // The native splash hides only once this frame is on screen, so there's never a blank flash.
      onLayout={() => void SplashScreen.hideAsync()}
      accessibilityLabel="Phenko Mat"
      accessibilityRole="image"
    >
      <View style={styles.center}>
        <Animated.View style={markStyle}>
          <Image source={require("@/assets/images/splash-icon.png")} style={styles.mark} contentFit="contain" transition={0} />
        </Animated.View>
        <Animated.View style={[styles.words, wordStyle]}>
          <Text weight="extrabold" size={34} color={colors.ink} style={styles.name}>
            phenko mat
          </Text>
          <Text weight="semibold" size="sm" color={colors.ink} align="center" style={styles.tagline}>
            Swipe to give and get things nearby
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.honey, zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mark: { width: NATIVE_MARK_SIZE, height: NATIVE_MARK_SIZE },
  // Sits below the mark's centre without pushing it, so the mark starts exactly where the native one was.
  words: { position: "absolute", top: "50%", marginTop: 44, alignItems: "center", paddingHorizontal: 24 },
  name: { letterSpacing: -1 },
  tagline: { marginTop: 4, opacity: 0.7 },
});
