import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  Button,
  EmptyState,
  ErrorNote,
  HeartIcon,
  PinIcon,
  PressableScale,
  RefreshIcon,
  SegmentedControl,
  Text,
  UndoIcon,
  XIcon,
} from "@/components/ui";
import { useCategoryMap } from "@/features/categories/api";
import { useMe } from "@/features/profile/api";
import { errorMessage, isApiError } from "@/lib/api/errors";
import type { FeedItem, SwipeSummary } from "@/shared/dto";
import { useUi, type FeedScope } from "@/stores/ui";
import { colors, radius, shadows } from "@/theme";
import { useFeed, useSwipeActions, useSwipeSummary } from "../api";
import { trackSeen } from "../views";
import { DeckSkeleton } from "./DeckSkeleton";
import { SwipeCard, type SwipeCardHandle, type SwipeDir } from "./SwipeCard";

const REFILL_AT = 3;
const VISIBLE_CARDS = 3;
const PREFETCH_CARDS = 6;
/** How many passes in a row can be taken back. */
const UNDO_DEPTH = 10;

/** How far (px) or how fast (px/s) a horizontal swipe must go to flip Nearby ⇄ Everywhere. */
const SCOPE_SWIPE_DISTANCE = 60;
const SCOPE_SWIPE_VELOCITY = 500;

const SCOPES = [
  { value: "nearby", label: "📍 Nearby" },
  { value: "all", label: "🌏 Everywhere" },
] as const;

/** Web: <SwipeDeck>. Used by the Feed tab, each category deck, and search results (`query`). */
export function SwipeDeck({ categoryId, query }: { categoryId?: string; query?: string }) {
  const { data: me } = useMe();
  // Default: nearby if we know where the user is, otherwise everything.
  const chosenScope = useUi((s) => s.feedScope);
  const setChosenScope = useUi((s) => s.setFeedScope);
  const scope: FeedScope | null = chosenScope ?? (me ? (me.location ? "nearby" : "all") : null);

  const { data, error, isLoading, refetch } = useFeed(categoryId, scope, query);
  const categories = useCategoryMap();
  const { swipe, resetPasses, undoPass } = useSwipeActions();
  const swiped = useUi((s) => s.swiped);
  const markSwiped = useUi((s) => s.markSwiped);
  const unmarkSwiped = useUi((s) => s.unmarkSwiped);
  const clearSwiped = useUi((s) => s.clearSwiped);
  const setMatch = useUi((s) => s.setMatch);
  const settleMatch = useUi((s) => s.settleMatch);
  const [swipeError, setSwipeError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const topCard = useRef<SwipeCardHandle>(null);
  const refilling = useRef(false);
  // Passes that can be undone (newest last), and cards brought back to the top of the deck.
  const [passed, setPassed] = useState<FeedItem[]>([]);
  const [restored, setRestored] = useState<FeedItem[]>([]);
  // In-flight swipe requests, so an undo never races ahead of the pass it's undoing.
  const pendingSwipes = useRef(new Map<string, Promise<unknown>>());

  const deck = useMemo(() => {
    const back = new Set(restored.map((i) => i.id));
    return [...restored, ...(data ?? []).filter((i) => !back.has(i.id))].filter((i) => !swiped[i.id]);
  }, [data, restored, swiped]);
  const top = deck[0];
  // Only when "Everywhere" runs dry: why it's empty, so we never offer "show passed items" with none to show.
  const { data: summary } = useSwipeSummary(categoryId, !top && scope === "all" && !query && Boolean(data));

  // The top card counts as a view for the owner's analytics.
  const topId = top?.id;
  useEffect(() => {
    if (topId) trackSeen(topId);
  }, [topId]);

  // Warm the image cache for the next few cards so they appear instantly.
  useEffect(() => {
    const urls = deck.slice(1, PREFETCH_CARDS).flatMap((i) => i.photos.slice(0, 1));
    if (urls.length) void Image.prefetch(urls, "memory-disk");
  }, [deck]);

  const onSwiped = useCallback(
    (item: FeedItem, dir: SwipeDir) => {
      markSwiped(item.id);
      if (dir === "right") {
        // Every right swipe on an active item connects, so celebrate now instead of after the round trip;
        // the request only has to supply the chat id (or say the item is gone) before "Send a message" needs it.
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMatch({
          itemId: item.id,
          item: {
            title: item.title,
            photo: item.photos[0] ?? "",
            priceInr: item.priceInr,
          },
          other: item.owner,
          connectionId: null,
          error: null,
        });
        router.push("/match");
      } else {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPassed((p) => [...p.filter((i) => i.id !== item.id), item].slice(-UNDO_DEPTH));
      }
      const request = swipe(item.id, dir);
      pendingSwipes.current.set(item.id, request);
      void request.finally(() => pendingSwipes.current.delete(item.id)).catch(() => {});
      request
        .then((res) => {
          setSwipeError(null);
          if (res.connection) settleMatch(item.id, { connectionId: res.connection.id });
        })
        .catch((e: unknown) => {
          // e.g. 410 when someone else got it first — it's already gone from the deck, just say why.
          const message = errorMessage(e, "Couldn't save that swipe.");
          setSwipeError(message);
          if (dir === "right") settleMatch(item.id, { error: message });
        });
    },
    [markSwiped, setMatch, settleMatch, swipe],
  );

  /** Brings the last passed card back on top; the server forgets that pass. */
  const undo = useCallback(() => {
    const item = passed.at(-1);
    if (!item) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPassed((p) => p.slice(0, -1));
    setRestored((r) => [item, ...r.filter((i) => i.id !== item.id)]);
    unmarkSwiped(item.id);
    setSwipeError(null);
    const pending = pendingSwipes.current.get(item.id) ?? Promise.resolve();
    void pending
      .catch(() => {})
      .then(() => undoPass(item.id))
      .catch((e: unknown) => setSwipeError(errorMessage(e, "Couldn't bring that one back.")));
  }, [passed, undoPass, unmarkSwiped]);

  const undoButton = passed.length ? (
    <PressableScale onPress={undo} style={styles.undoButton} accessibilityLabel="Undo last pass">
      <UndoIcon size={22} color={colors.honeyDeep} strokeWidth={2.4} />
    </PressableScale>
  ) : (
    <View style={styles.undoSpacer} />
  );

  // Top up the deck before it runs dry.
  useEffect(() => {
    if (!data || data.length === 0 || deck.length > REFILL_AT || refilling.current) return;
    refilling.current = true;
    void refetch().finally(() => {
      refilling.current = false;
    });
  }, [data, deck.length, refetch]);

  const openLocation = () => router.push({ pathname: "/location", params: { then: "nearby" } });

  function pickScope(next: FeedScope) {
    if (next === "nearby" && !me?.location) return openLocation();
    setChosenScope(next);
  }

  /** Swipe left → the option to the right (Everywhere); swipe right → Nearby. */
  const swipeScope = useCallback(
    (translationX: number, velocityX: number) => {
      const far = Math.abs(translationX) > SCOPE_SWIPE_DISTANCE || Math.abs(velocityX) > SCOPE_SWIPE_VELOCITY;
      if (!far || !scope) return;
      const next: FeedScope = translationX < 0 ? "all" : "nearby";
      // A stray swipe shouldn't pop open the location screen; the pill tap still does.
      if (next === scope || (next === "nearby" && !me?.location)) return;
      void Haptics.selectionAsync();
      setChosenScope(next);
    },
    [me?.location, scope, setChosenScope],
  );
  // Two instances: a gesture object can only be attached to one detector. Card swipes win over these
  // (cards activate after 8px, these after 24px), and vertical movement cancels them.
  // The full-screen one only runs with no cards left, and only on the main feed: category decks sit
  // in a stack where a horizontal drag should stay free for swipe-back.
  const screenSwipeEnabled = !top && !categoryId && !query;
  const [pillSwipe, screenSwipe] = useMemo(() => {
    const make = () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd((e) => swipeScope(e.translationX, e.velocityX));
    return [make(), make().enabled(screenSwipeEnabled)];
  }, [swipeScope, screenSwipeEnabled]);

  async function showPassedAgain() {
    setResetting(true);
    try {
      await resetPasses(categoryId);
      clearSwiped();
    } catch (e) {
      setSwipeError(errorMessage(e));
    } finally {
      setResetting(false);
    }
  }

  const failed = Boolean(error) && !isApiError(error, "LOCATION_REQUIRED");
  const loading = !scope || (isLoading && !data);

  let body;
  if (failed) {
    body = <ErrorNote message={errorMessage(error)} onRetry={() => void refetch()} />;
  } else if (loading) {
    body = <DeckSkeleton />;
  } else if (!top && query) {
    // Search already includes items passed on before, so there's nothing to "show again".
    body =
      scope === "nearby" ? (
        <EmptyState
          emoji="🔍"
          title={`No “${query}” nearby`}
          body={`Nothing matching within ${me?.radiusKm ?? 10} km right now. It might be listed a little further away.`}
          action={<Button label="Search everywhere" onPress={() => setChosenScope("all")} />}
        />
      ) : (
        <EmptyState
          emoji="🔍"
          title={`No “${query}” yet`}
          body="Nobody has listed one yet. Try another word, or check back soon."
        />
      );
  } else if (!top) {
    body =
      scope === "nearby" ? (
        <EmptyState
          emoji="📍"
          title="Nothing new nearby"
          body={`No more items within ${me?.radiusKm ?? 10} km right now. You can still browse everything on Phenko Mat.`}
          action={
            <View style={styles.emptyActions}>
              <Button label="See all items" onPress={() => setChosenScope("all")} />
              <Pressable onPress={openLocation} accessibilityRole="button" hitSlop={8}>
                <Text weight="semibold" size="sm" style={styles.underline}>
                  Widen search radius
                </Text>
              </Pressable>
            </View>
          }
        />
      ) : (
        <ExhaustedDeck
          summary={summary}
          inCategory={Boolean(categoryId)}
          resetting={resetting}
          onReset={showPassedAgain}
        />
      );
  } else {
    body = (
      <View style={styles.deckArea}>
        {swipeError ? (
          <Animated.View entering={FadeIn} style={styles.swipeError} accessibilityRole="alert">
            <Text size="sm" weight="medium" align="center">
              {swipeError}
            </Text>
          </Animated.View>
        ) : null}
        <View style={styles.stack}>
          {deck
            .slice(0, VISIBLE_CARDS)
            .map((item, depth) => (
              <SwipeCard
                key={item.id}
                ref={depth === 0 ? topCard : undefined}
                item={item}
                categories={categories}
                depth={depth}
                onSwiped={onSwiped}
              />
            ))
            .reverse()}
        </View>

        <View style={styles.buttons}>
          {undoButton}
          <PressableScale onPress={() => topCard.current?.fling("left")} style={styles.passButton} accessibilityLabel="Pass">
            <XIcon size={30} strokeWidth={2.6} color={colors.inkSoft} />
          </PressableScale>
          <PressableScale onPress={() => topCard.current?.fling("right")} style={styles.wantButton} accessibilityLabel="I want this">
            <HeartIcon size={34} filled />
          </PressableScale>
          <View style={styles.undoSpacer} />
        </View>
        <Text size="xs" color={colors.inkSoft} align="center" style={styles.hint}>
          Swipe right to connect with the owner
        </Text>
      </View>
    );
  }

  // Passed the last card by mistake: offer it back under the "all done" message.
  if (!failed && !loading && !top && passed.length) {
    body = (
      <View style={styles.root}>
        {body}
        <Pressable onPress={undo} style={styles.undoLink} accessibilityRole="button" hitSlop={8}>
          <UndoIcon size={16} color={colors.ink} />
          <Text weight="semibold" size="sm" style={styles.underline}>
            Bring back the last one
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <GestureDetector gesture={screenSwipe}>
      <View style={styles.root}>
        <GestureDetector gesture={pillSwipe}>
          <View style={styles.scopeWrap}>
            <View style={styles.scopeRow}>
              <SegmentedControl options={SCOPES} value={scope} onChange={pickScope} shadow style={styles.flex1} />
            </View>
            {me && !me.location ? (
              <Pressable onPress={openLocation} style={styles.locationNudge} accessibilityRole="button">
                <PinIcon size={15} />
                <Text weight="semibold" size="sm">
                  Set your location to see what&apos;s close to you
                </Text>
              </Pressable>
            ) : null}
          </View>
        </GestureDetector>
        {body}
      </View>
    </GestureDetector>
  );
}

/** "Everywhere" has nothing left: say why, and only offer what will actually bring cards back. */
function ExhaustedDeck({
  summary,
  inCategory,
  resetting,
  onReset,
}: {
  summary: SwipeSummary | undefined;
  inCategory: boolean;
  resetting: boolean;
  onReset: () => void;
}) {
  const where = inCategory ? "in this category" : "right now";

  if (summary && summary.passed > 0) {
    const n = summary.passed;
    return (
      <EmptyState
        emoji="🐝"
        title="You've seen it all"
        body={`You've swiped through everything ${where}. You passed on ${n} ${n === 1 ? "item" : "items"} — give ${n === 1 ? "it" : "them"} another look?`}
        action={
          <Button
            label={resetting ? "Loading…" : `Show ${n} passed ${n === 1 ? "item" : "items"} again`}
            icon={<RefreshIcon size={18} color={colors.white} />}
            onPress={onReset}
            disabled={resetting}
          />
        }
      />
    );
  }

  if (summary && summary.wanted > 0) {
    return (
      <EmptyState
        emoji="💛"
        title="You've said yes to everything"
        body={`You swiped right on every listing ${where} — they're waiting in your chats. New things show up here as neighbours post them.`}
        action={<Button label="Go to your chats" onPress={() => router.navigate("/chats")} />}
      />
    );
  }

  return (
    <EmptyState
      emoji="🐝"
      title="You've seen it all"
      body="There's nothing new to swipe on right now. Check back soon — neighbours post new things every day."
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scopeWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  scopeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex1: { flex: 1 },
  locationNudge: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  deckArea: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  swipeError: {
    marginBottom: 8,
    borderRadius: radius.md,
    backgroundColor: colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stack: { flex: 1, minHeight: 360 },
  buttons: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  undoButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.button,
  },
  undoSpacer: { width: 48, height: 48 },
  undoLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingBottom: 24 },
  passButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.button,
  },
  wantButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.honey,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.honey,
  },
  hint: { marginTop: 12 },
  emptyActions: { alignItems: "center", gap: 12 },
  underline: { textDecorationLine: "underline" },
});
