import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Button, HeartIcon, Photo, Text } from "@/components/ui";
import { useUi } from "@/stores/ui";
import { colors, MAX_CONTENT_WIDTH, motion, radius, shadows } from "@/theme";

/** Web: <MatchModal>. Presented as a full-screen modal route over the deck. */
export function MatchScreen() {
  const insets = useSafeAreaInsets();
  const match = useUi((s) => s.match);

  // Deep-linked or restored without state: nothing to celebrate. Checked on open only — the match stays in
  // the store after we leave (the chat reads it until its id arrives), so this must not react to changes.
  useEffect(() => {
    if (!useUi.getState().match && router.canGoBack()) router.back();
  }, []);

  if (!match) return <View style={styles.root} />;

  const close = () => router.back();

  // Open the chat now; if the swipe request hasn't returned the chat id yet, the chat picks it up when it does.
  const message = () =>
    router.replace(
      match.connectionId
        ? { pathname: "/chat/[id]", params: { id: match.connectionId } }
        : { pathname: "/chat/[id]", params: { id: "new", item: match.itemId } },
    );

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.inner} accessibilityViewIsModal>
        <Animated.View entering={ZoomIn.duration(motion.enterMs).easing(Easing.out(Easing.cubic))} style={styles.art}>
          <View style={[styles.frame, styles.left]}>
            <Photo uri={match.item.photo} accessibilityLabel={match.item.title} />
          </View>
          <View style={[styles.frame, styles.right]}>
            <Avatar user={match.other} size={88} />
          </View>
          <View style={styles.heart}>
            <HeartIcon size={28} filled />
          </View>
        </Animated.View>

        <Text weight="black" size="4xl" align="center" leading={1.2} accessibilityRole="header">
          It&apos;s a connection!
        </Text>
        <Text size="lg" align="center" style={styles.mt3}>
          {match.other.name.split(" ")[0]} is passing on{" "}
          <Text size="lg" weight="bold">
            {match.item.title}
          </Text>
          . Say hi and plan the pickup.
        </Text>

        {match.error ? (
          <Text weight="semibold" align="center" style={styles.error} accessibilityRole="alert">
            {match.error}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {match.error ? null : (
            <Button block size="lg" label="Send a message" onPress={message} />
          )}
          <Button block size="lg" variant="outline" label="Keep swiping" onPress={close} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.honey, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  inner: { width: "100%", maxWidth: Math.min(384, MAX_CONTENT_WIDTH) },
  art: { alignSelf: "center", width: 288, height: 176, marginBottom: 32, alignItems: "center", justifyContent: "center" },
  frame: {
    position: "absolute",
    width: 128,
    height: 160,
    borderRadius: radius.tile,
    borderWidth: 4,
    borderColor: colors.white,
    overflow: "hidden",
    ...shadows.xl,
  },
  left: { left: 16, transform: [{ rotate: "-6deg" }] },
  right: { right: 16, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center", transform: [{ rotate: "6deg" }] },
  heart: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    ...shadows.xl,
  },
  mt3: { marginTop: 12 },
  error: { marginTop: 20, borderRadius: radius.md, backgroundColor: colors.cream, paddingHorizontal: 12, paddingVertical: 10 },
  actions: { marginTop: 32, gap: 12 },
});
