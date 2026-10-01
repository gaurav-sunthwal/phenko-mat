import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Avatar, Button, ErrorNote, HeartIcon, PencilIcon, SegmentedControl, Spinner, Text } from "@/components/ui";
import { useCategoryMap } from "@/features/categories/api";
import { useConnections } from "@/features/connections/api";
import { SwipeCard } from "@/features/feed/components/SwipeCard";
import { useSwipeActions } from "@/features/feed/api";
import { trackSeen } from "@/features/feed/views";
import { useMe } from "@/features/profile/api";
import { BackTitle } from "@/features/shell/ScreenTitle";
import { errorMessage } from "@/lib/api/errors";
import { useUi } from "@/stores/ui";
import { colors, radius } from "@/theme";
import { useItem } from "./api";
import { ListingInsights } from "./ListingInsights";

const noop = () => {};

const OWNER_TABS = [
  { value: "preview", label: "Preview" },
  { value: "insights", label: "Insights" },
] as const;

/**
 * One listing as the same card people swipe on. For the owner: a preview with "Edit listing". For
 * anyone else (opened from a chat or someone's profile): who's giving it, "I want this" / "Open chat",
 * and Report.
 */
export function ListingPreview({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const { data, error, refetch } = useItem(id);
  const { data: me } = useMe();
  const { data: chats } = useConnections();
  const categories = useCategoryMap();
  const { swipe } = useSwipeActions();
  const setMatch = useUi((s) => s.setMatch);
  const settleMatch = useUi((s) => s.settleMatch);
  const markSwiped = useUi((s) => s.markSwiped);
  const [wanting, setWanting] = useState(false);
  const [tab, setTab] = useState<"preview" | "insights">("preview");

  const isOwner = Boolean(me && data && data.owner.id === me.id);
  // Distance depends on who's looking; from the owner's own spot it would always read "100 m away".
  const item = useMemo(() => data && (isOwner ? { ...data, distanceKm: null } : data), [data, isOwner]);
  const chat = chats?.find((c) => c.role === "taker" && c.item.id === id);

  const showInsights = isOwner && tab === "insights";

  // Someone else opening the listing counts as a view for its owner.
  const viewedBySomeoneElse = Boolean(me && data && !isOwner);
  useEffect(() => {
    if (viewedBySomeoneElse) trackSeen(id);
  }, [viewedBySomeoneElse, id]);

  function want() {
    if (!data) return;
    setWanting(true);
    markSwiped(data.id);
    setMatch({
      itemId: data.id,
      item: { title: data.title, photo: data.photos[0] ?? "", priceInr: data.priceInr },
      other: data.owner,
      connectionId: null,
      error: null,
    });
    router.push("/match");
    swipe(data.id, "right")
      .then((res) => res.connection && settleMatch(data.id, { connectionId: res.connection.id }))
      .catch((e: unknown) => settleMatch(data.id, { error: errorMessage(e, "Couldn't connect. Try again.") }))
      .finally(() => setWanting(false));
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <BackTitle title={isOwner ? "Preview" : "Listing"} fallback={isOwner ? "/profile" : "/feed"} />
      {error ? (
        <ErrorNote message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : !item || !me ? (
        <Spinner />
      ) : (
        <View style={styles.body}>
          {isOwner ? <SegmentedControl options={OWNER_TABS} value={tab} onChange={setTab} style={styles.tabs} /> : null}
          {showInsights ? (
            <ListingInsights id={id} />
          ) : isOwner ? (
            <Text size="sm" color={colors.inkSoft} align="center" style={styles.hint}>
              {item.status === "active"
                ? "This is how people nearby see your listing. Tap the photo to flip through, or ⓘ for details."
                : "Marked as given, so it's hidden from the feed. Relist it to show it again."}
            </Text>
          ) : null}
          {showInsights ? null : (
            <View style={styles.stack}>
              <SwipeCard item={item} categories={categories} depth={0} onSwiped={noop} preview />
            </View>
          )}

          {showInsights ? null : isOwner ? (
            <Button
              block
              size="lg"
              weight="extrabold"
              label="Edit listing"
              icon={<PencilIcon size={18} color={colors.white} />}
              onPress={() => router.push(`/listing/${id}/edit`)}
              style={styles.mt4}
            />
          ) : (
            <>
              <Pressable
                onPress={() => router.push(`/user/${item.owner.id}`)}
                style={({ pressed }) => [styles.owner, pressed && { backgroundColor: colors.cream }]}
                accessibilityRole="button"
                accessibilityLabel={`View ${item.owner.name}'s profile`}
              >
                <Avatar user={item.owner} size={40} />
                <View style={styles.flex}>
                  <Text weight="bold" numberOfLines={1}>
                    {item.owner.name}
                  </Text>
                  <Text size="xs" color={colors.inkSoft}>
                    View profile and other listings
                  </Text>
                </View>
              </Pressable>
              {chat ? (
                <Button block size="lg" weight="extrabold" label="Open chat" onPress={() => router.push(`/chat/${chat.id}`)} style={styles.mt3} />
              ) : item.status === "active" ? (
                <Button
                  block
                  size="lg"
                  weight="extrabold"
                  variant="honey"
                  label="I want this"
                  icon={<HeartIcon size={20} filled />}
                  onPress={want}
                  disabled={wanting}
                  style={styles.mt3}
                />
              ) : (
                <Text weight="semibold" size="sm" color={colors.inkSoft} align="center" style={styles.mt3}>
                  Someone already got this one.
                </Text>
              )}
              <Pressable
                onPress={() => router.push({ pathname: "/report", params: { kind: "item", id: item.id, label: item.title } })}
                style={styles.report}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text weight="semibold" size="sm" color={colors.inkSoft} style={styles.underline}>
                  Report this listing
                </Text>
              </Pressable>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  body: { flex: 1, paddingHorizontal: 16 },
  hint: { marginBottom: 12, paddingHorizontal: 8 },
  tabs: { marginBottom: 12 },
  stack: { flex: 1, minHeight: 320, borderRadius: radius.sheet },
  mt3: { marginTop: 12 },
  mt4: { marginTop: 16 },
  flex: { flex: 1, minWidth: 0 },
  owner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
  },
  report: { alignSelf: "center", marginTop: 16 },
  underline: { textDecorationLine: "underline" },
});
