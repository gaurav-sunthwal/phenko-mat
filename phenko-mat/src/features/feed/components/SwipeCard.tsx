import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useImperativeHandle, useState, type Ref } from "react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Avatar, CategoryPill, ChevronDownIcon, IconButton, InfoIcon, Photo, PinIcon, Text } from "@/components/ui";
import { useNow } from "@/hooks/useNow";
import type { Category, FeedItem } from "@/shared/dto";
import { CONDITION_LABEL, formatDistance, formatPrice, timeAgo } from "@/shared/format";
import { alpha, colors, motion, radius, shadows } from "@/theme";
import { trackDetails } from "../views";
import { PhotoViewer } from "./PhotoViewer";

export type SwipeDir = "left" | "right";

/** Distance (px) or fling speed (px/s) that commits a swipe. */
const THRESHOLD = 110;
const VELOCITY_THRESHOLD = 900;
const EXIT_MS = 260;

export interface SwipeCardHandle {
  /** Animate the card off-screen (used by the ✕ / ♥ buttons). */
  fling: (dir: SwipeDir) => void;
}

interface Props {
  item: FeedItem;
  categories: Map<string, Pick<Category, "id" | "name" | "emoji">>;
  depth: number;
  onSwiped: (item: FeedItem, dir: SwipeDir) => void;
  /** Owner's preview: looks and taps exactly like the feed, but can't be swiped away. */
  preview?: boolean;
  ref?: Ref<SwipeCardHandle>;
}

/**
 * One card of the deck. All drag/fling motion runs on the UI thread (Reanimated + Gesture Handler),
 * so swiping stays at 60–120 fps even while React is busy.
 */
export const SwipeCard = memo(function SwipeCard({ item, categories, depth, onSwiped, preview, ref }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const isTop = depth === 0;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const cardWidth = useSharedValue(screenWidth);
  const leaving = useSharedValue(false);
  // Animate the stack position so the next card glides forward when the top one leaves.
  const stackDepth = useSharedValue(depth);
  useEffect(() => {
    stackDepth.set(withSpring(depth, motion.cardSpring));
  }, [depth, stackDepth]);

  const exitX = screenWidth * 1.6;

  function finish(dir: SwipeDir) {
    onSwiped(item, dir);
  }

  function flipPhoto(tapX: number, width: number) {
    if (item.photos.length < 2) return;
    const next = tapX < width / 2 ? photoIndex - 1 : photoIndex + 1;
    setPhotoIndex(Math.max(0, Math.min(item.photos.length - 1, next)));
  }

  /** Animates the card off-screen, then tells the deck. Runs on either thread. */
  function flyOut(dir: SwipeDir, fromY: number) {
    "worklet";
    if (leaving.get()) return;
    leaving.set(true);
    x.set(
      withTiming(dir === "right" ? exitX : -exitX, { duration: EXIT_MS }, (done) => {
        if (done) scheduleOnRN(finish, dir);
      }),
    );
    y.set(withTiming(fromY + 40, { duration: EXIT_MS }));
  }

  useImperativeHandle(ref, () => ({ fling: (dir) => flyOut(dir, 0) }));

  const pan = Gesture.Pan()
    .enabled(isTop && !showInfo && !preview)
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      if (leaving.get()) return;
      x.set(e.translationX);
      y.set(e.translationY);
    })
    .onEnd((e) => {
      if (leaving.get()) return;
      const commit = Math.abs(e.translationX) > THRESHOLD || Math.abs(e.velocityX) > VELOCITY_THRESHOLD;
      const dir: SwipeDir = (Math.abs(e.velocityX) > VELOCITY_THRESHOLD ? e.velocityX : e.translationX) > 0 ? "right" : "left";
      if (commit) {
        flyOut(dir, e.translationY);
      } else {
        x.set(withSpring(0, motion.cardSpring));
        y.set(withSpring(0, motion.cardSpring));
      }
    });

  // Tap: left/right half flips photos, like Bumble.
  const tap = Gesture.Tap()
    .enabled(isTop && !showInfo)
    .maxDistance(6)
    .onEnd((e, success) => {
      if (success) scheduleOnRN(flipPhoto, e.x, cardWidth.get());
    });

  const gesture = Gesture.Race(pan, tap);

  // One formula for every card: drag offsets (only ever non-zero on the top card) + stack position.
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.get() },
      { translateY: y.get() + stackDepth.get() * 10 },
      { rotate: `${x.get() / 16}deg` },
      { scale: 1 - stackDepth.get() * 0.04 },
    ],
  }));

  const wantStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [-THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const place = [formatDistance(item.distanceKm), item.area].filter(Boolean).join(" · ");

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { zIndex: 10 - depth }, cardStyle]}
        pointerEvents={isTop ? "auto" : "none"}
        accessibilityElementsHidden={!isTop}
        importantForAccessibility={isTop ? "auto" : "no-hide-descendants"}
        onLayout={(e) => {
          cardWidth.set(e.nativeEvent.layout.width);
        }}
      >
        <View style={styles.card}>
          <Photo uri={item.photos[photoIndex]} accessibilityLabel={item.title} priority={isTop ? "high" : "normal"} transition={0} />

          {item.photos.length > 1 ? (
            <View style={styles.progress} pointerEvents="none">
              {item.photos.map((_, i) => (
                <View key={i} style={[styles.progressBar, { backgroundColor: i === photoIndex ? colors.white : alpha(colors.white, 0.4) }]} />
              ))}
            </View>
          ) : null}

          {/* Swipe stamps */}
          <Animated.View style={[styles.stamp, styles.stampWant, wantStyle]} pointerEvents="none">
            <Text weight="extrabold" size="3xl" color={colors.honey} style={styles.stampText}>
              WANT IT
            </Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampPass, passStyle]} pointerEvents="none">
            <Text weight="extrabold" size="3xl" color={colors.white} style={styles.stampText}>
              PASS
            </Text>
          </Animated.View>

          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.85)"]}
            locations={[0, 0.45, 1]}
            style={styles.scrim}
            pointerEvents="none"
          />

          <View style={styles.meta}>
            <View style={styles.badges}>
              <View style={styles.priceBadge}>
                <Text weight="extrabold" size="sm">
                  {formatPrice(item.priceInr)}
                </Text>
              </View>
              <View style={styles.glassBadge}>
                <Text weight="semibold" size="xs" color={colors.white}>
                  {CONDITION_LABEL[item.condition]}
                </Text>
              </View>
            </View>
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <Text weight="extrabold" size={26.4} leading={1.2} color={colors.white} numberOfLines={3}>
                  {item.title}
                </Text>
                {place ? (
                  <View style={styles.place}>
                    <PinIcon size={15} color={alpha(colors.white, 0.85)} />
                    <Text size="sm" color={alpha(colors.white, 0.85)} numberOfLines={1} style={styles.flexShrink}>
                      {place}
                    </Text>
                  </View>
                ) : null}
              </View>
              {isTop ? (
                <IconButton
                  icon={<InfoIcon size={22} color={colors.white} />}
                  background={alpha(colors.white, 0.25)}
                  accessibilityLabel="More about this item"
                  onPress={() => {
                    setShowInfo(true);
                    if (!preview) trackDetails(item.id);
                  }}
                  style={styles.infoButton}
                />
              ) : null}
            </View>
            <View style={styles.pills}>
              {item.categoryIds.map((id) => {
                const c = categories.get(id);
                return c ? <CategoryPill key={id} category={c} tone="glass" /> : null;
              })}
            </View>
          </View>

          {showInfo ? <ItemDetails item={item} preview={preview} onClose={() => setShowInfo(false)} /> : null}
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

function ItemDetails({ item, preview, onClose }: { item: FeedItem; preview?: boolean; onClose: () => void }) {
  const now = useNow();
  const [viewing, setViewing] = useState<number | null>(null);
  return (
    <Animated.View entering={SlideInDown.duration(motion.enterMs).easing(Easing.out(Easing.cubic))} exiting={SlideOutDown.duration(200)} style={styles.details}>
      <ScrollView contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
        <Text weight="extrabold" size="xl" style={styles.detailsTitle}>
          {item.title}
        </Text>
        <Text size="sm" color={colors.inkSoft} style={styles.mt1}>
          {formatPrice(item.priceInr)} · {CONDITION_LABEL[item.condition]} · listed {timeAgo(item.createdAt, now)}
        </Text>
        {item.description ? (
          <Text leading={1.6} style={styles.mt4}>
            {item.description}
          </Text>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs} style={styles.mt4}>
          {item.photos.map((uri, i) => (
            <Pressable
              key={uri}
              onPress={() => setViewing(i)}
              style={styles.thumb}
              accessibilityRole="button"
              accessibilityLabel={`View photo ${i + 1} full screen`}
            >
              <Photo uri={uri} />
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          onPress={() => router.push(`/user/${item.owner.id}`)}
          style={({ pressed }) => [styles.owner, pressed && { backgroundColor: colors.cream }]}
          accessibilityRole="button"
          accessibilityLabel={`View ${item.owner.name}'s profile`}
        >
          <Avatar user={item.owner} size={44} />
          <View style={styles.flex}>
            <Text weight="bold">{item.owner.name}</Text>
            <Text size="sm" color={colors.inkSoft}>
              {[item.area, formatDistance(item.distanceKm)].filter(Boolean).join(" · ") || "View profile"}
            </Text>
          </View>
        </Pressable>
        <Text size="xs" color={colors.inkSoft} style={styles.mt4}>
          Exact pickup spot is shared in chat, only after you both connect.
        </Text>
        {preview ? null : (
          <Pressable
            onPress={() => router.push({ pathname: "/report", params: { kind: "item", id: item.id, label: item.title } })}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.mt3}
          >
            <Text weight="semibold" size="xs" color={colors.inkSoft} style={styles.underline}>
              Report this listing
            </Text>
          </Pressable>
        )}
      </ScrollView>
      {viewing !== null ? <PhotoViewer photos={item.photos} start={viewing} alt={item.title} onClose={() => setViewing(null)} /> : null}
      <IconButton
        icon={<ChevronDownIcon size={20} />}
        size={36}
        background={colors.cream}
        accessibilityLabel="Close details"
        onPress={onClose}
        style={styles.detailsClose}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  thumbs: { gap: 8 },
  thumb: { width: 64, height: 64, borderRadius: radius.md, overflow: "hidden" },
  mt3: { marginTop: 12 },
  underline: { textDecorationLine: "underline" },
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1 },
  card: {
    flex: 1,
    borderRadius: radius.sheet,
    overflow: "hidden",
    backgroundColor: colors.ink,
    ...shadows.card,
  },
  progress: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", gap: 6 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  stamp: {
    position: "absolute",
    top: 40,
    borderWidth: 4,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 4,
    zIndex: 2,
  },
  stampWant: { left: 24, borderColor: colors.honey, transform: [{ rotate: "-12deg" }] },
  stampPass: { right: 24, borderColor: colors.white, transform: [{ rotate: "12deg" }] },
  stampText: { letterSpacing: 1 },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "67%" },
  meta: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20 },
  badges: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  priceBadge: { borderRadius: radius.full, backgroundColor: colors.white, paddingHorizontal: 12, paddingVertical: 4 },
  glassBadge: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: alpha(colors.white, 0.2) },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  place: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  infoButton: { marginBottom: 4 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  details: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "78%",
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    zIndex: 5,
  },
  detailsContent: { padding: 24 },
  detailsTitle: { paddingRight: 40 },
  detailsClose: { position: "absolute", top: 16, right: 16 },
  owner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.paper,
  },
  mt1: { marginTop: 4 },
  mt4: { marginTop: 16 },
});
