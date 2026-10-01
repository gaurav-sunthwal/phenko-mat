import { FlashList } from "@shopify/flash-list";
import { Link, router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { ErrorNote, PlusIcon, PressableScale, Spinner, Text } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { errorMessage } from "@/lib/api/errors";
import type { Category } from "@/shared/dto";
import { colors, radius } from "@/theme";
import { useCategories } from "../api";
import { CategorySearch } from "./CategorySearch";

const TIER_STYLE: Record<string, { bg: string; fg: string }> = {
  premium: { bg: colors.ink, fg: colors.honey },
  normal: { bg: colors.honey, fg: colors.ink },
  "daily-needs": { bg: colors.mint, fg: colors.ink },
};

const NEW_TILE = "__new__";

function count(c: Category) {
  const total = `${c.totalCount} ${c.totalCount === 1 ? "item" : "items"}`;
  return c.nearbyCount > 0 ? `${c.nearbyCount} nearby · ${total}` : total;
}

export function CategoriesScreen() {
  const { data, error, isLoading, refetch } = useCategories();
  const { refreshing, onRefresh } = usePullToRefresh(refetch);
  const [query, setQuery] = useState("");
  const searching = query.trim().length > 0;

  const { tiers, grid } = useMemo(() => {
    const list = data ?? [];
    return {
      tiers: list.filter((c) => c.group === "tier"),
      grid: [...list.filter((c) => c.group !== "tier"), NEW_TILE] as (Category | typeof NEW_TILE)[],
    };
  }, [data]);

  if (error) return <ErrorNote message={errorMessage(error)} onRetry={() => void refetch()} />;
  if (isLoading || !data) return <Spinner />;

  return (
    <FlashList
      // While searching, the header shows the results; the category grid steps aside.
      data={searching ? [] : grid}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      numColumns={2}
      keyExtractor={(c) => (c === NEW_TILE ? c : c.id)}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.honeyDeep} />}
      ListHeaderComponent={
        <View>
          <Text weight="black" size="3xl" accessibilityRole="header">
            Browse
          </Text>
          <Text color={colors.inkSoft} style={styles.mt1}>
            Search, or pick a category and swipe through just that.
          </Text>
          <CategorySearch categories={data} query={query} onChange={setQuery} />
          {searching ? null : (
            <>
              <View style={styles.tiers}>
                {tiers.map((c) => {
                  const tone = TIER_STYLE[c.id] ?? { bg: colors.cream, fg: colors.ink };
                  return (
                    <Link key={c.id} href={{ pathname: "/categories/[id]", params: { id: c.id } }} asChild>
                      <PressableScale
                        activeScale={0.98}
                        style={StyleSheet.flatten([styles.tier, { backgroundColor: tone.bg }])}
                        accessibilityRole="link"
                      >
                        <View style={styles.flex}>
                          <Text weight="extrabold" size="xl" color={tone.fg}>
                            {c.name}
                          </Text>
                          {c.blurb ? (
                            <Text size="sm" color={tone.fg} style={[styles.mt05, styles.soft]}>
                              {c.blurb}
                            </Text>
                          ) : null}
                          <Text weight="bold" size="xs" color={tone.fg} style={[styles.count, styles.softer]}>
                            {count(c).toUpperCase()}
                          </Text>
                        </View>
                        <Text size={48}>{c.emoji}</Text>
                      </PressableScale>
                    </Link>
                  );
                })}
              </View>
              <Text weight="extrabold" size="lg" style={styles.sectionTitle}>
                All categories
              </Text>
            </>
          )}
        </View>
      }
      renderItem={({ item, index }) => (
        <View style={[styles.cell, index % 2 === 0 ? styles.cellLeft : styles.cellRight]}>
          {item === NEW_TILE ? (
            <Pressable
              onPress={() => router.push("/new-category")}
              style={({ pressed }) => [styles.newTile, pressed && { borderColor: colors.honey }]}
              accessibilityRole="button"
            >
              <PlusIcon size={26} color={colors.inkSoft} />
              <Text weight="bold" color={colors.inkSoft}>
                New category
              </Text>
            </Pressable>
          ) : (
            <Link href={{ pathname: "/categories/[id]", params: { id: item.id } }} asChild>
              <PressableScale activeScale={0.97} style={styles.tile} accessibilityRole="link" accessibilityLabel={item.name}>
                <Text size={30}>{item.emoji}</Text>
                <Text weight="bold" style={styles.mt3} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text size="xs" color={colors.inkSoft} numberOfLines={1}>
                  {count(item)}
                </Text>
              </PressableScale>
            </Link>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  mt05: { marginTop: 2 },
  mt1: { marginTop: 4 },
  mt3: { marginTop: 12 },
  soft: { opacity: 0.8 },
  softer: { opacity: 0.7 },
  tiers: { marginTop: 20, gap: 12 },
  tier: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.tile,
    padding: 20,
  },
  count: { marginTop: 8, letterSpacing: 0.6 },
  sectionTitle: { marginTop: 32, marginBottom: 12 },
  cell: { paddingBottom: 12 },
  cellLeft: { paddingRight: 6 },
  cellRight: { paddingLeft: 6 },
  tile: {
    minHeight: 116,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: 16,
    justifyContent: "space-between",
  },
  newTile: {
    minHeight: 116,
    borderRadius: radius.card,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.line,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
