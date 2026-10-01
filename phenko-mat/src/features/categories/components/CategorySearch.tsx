import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Chip, SearchIcon, StackIcon, Text, XIcon } from "@/components/ui";
import type { Category } from "@/shared/dto";
import { useRecentSearches } from "@/stores/recentSearches";
import { colors, fonts, radius } from "@/theme";

const MAX_QUERY = 80;

/**
 * Search bar on Browse. Typing filters categories on the spot; submitting (or the "Swipe through" row)
 * opens the matching listings as a swipe deck. Recent searches show while the field is empty.
 */
export function CategorySearch({ categories, query, onChange }: { categories: Category[]; query: string; onChange: (q: string) => void }) {
  const [focused, setFocused] = useState(false);
  const recent = useRecentSearches((s) => s.terms);
  const removeRecent = useRecentSearches((s) => s.remove);
  const term = query.trim();
  const needle = term.toLowerCase();
  const matches = needle ? categories.filter((c) => c.name.toLowerCase().includes(needle)) : [];

  function search(q: string) {
    const t = q.trim();
    if (!t) return;
    useRecentSearches.getState().add(t);
    router.push({ pathname: "/categories/search", params: { q: t } });
  }

  return (
    <View style={styles.root}>
      <View style={[styles.box, { borderColor: focused ? colors.honey : colors.line }]}>
        <SearchIcon size={18} color={colors.inkSoft} />
        <TextInput
          value={query}
          onChangeText={onChange}
          onSubmitEditing={() => search(query)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Search sofas, books, shoes…"
          placeholderTextColor={colors.inkSoft}
          selectionColor={colors.honeyDeep}
          cursorColor={colors.ink}
          returnKeyType="search"
          autoCorrect={false}
          maxLength={MAX_QUERY}
          accessibilityLabel="Search listings and categories"
          style={styles.input}
        />
        {query ? (
          <Pressable onPress={() => onChange("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <XIcon size={16} color={colors.inkSoft} />
          </Pressable>
        ) : null}
      </View>

      {term ? (
        <>
          <Pressable
            onPress={() => search(term)}
            style={({ pressed }) => [styles.swipeRow, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.swipeIcon}>
              <StackIcon size={20} />
            </View>
            <View style={styles.flex}>
              <Text weight="bold" numberOfLines={1}>
                Swipe through “{term}”
              </Text>
              <Text size="xs" color={colors.inkSoft}>
                Every listing that matches, one card at a time
              </Text>
            </View>
          </Pressable>
          {matches.length ? (
            <View>
              <Text weight="bold" size="sm" color={colors.inkSoft} style={styles.label}>
                Categories
              </Text>
              <View style={styles.chips}>
                {matches.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    emoji={c.emoji}
                    onPress={() => router.push({ pathname: "/categories/[id]", params: { id: c.id } })}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : recent.length ? (
        <View>
          <Text weight="bold" size="sm" color={colors.inkSoft} style={styles.label}>
            Recent
          </Text>
          <View style={styles.chips}>
            {recent.map((t) => (
              <Chip
                key={t}
                label={t}
                onPress={() => search(t)}
                onLongPress={() => removeRecent(t)}
                accessibilityHint="Long press to remove"
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 16, gap: 12 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
  },
  input: { flex: 1, paddingVertical: 12, fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  swipeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.honey,
  },
  pressed: { opacity: 0.85 },
  swipeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, minWidth: 0 },
  label: { marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
