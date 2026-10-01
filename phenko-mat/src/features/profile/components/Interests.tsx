import { StyleSheet, View } from "react-native";
import { CheckIcon, Chip, Text } from "@/components/ui";
import { useCategories } from "@/features/categories/api";
import type { Me } from "@/shared/dto";
import { colors } from "@/theme";
import { useUpdateMe } from "../api";

/** Toggle chips that boost categories in the feed ranking. */
export function Interests({ me }: { me: Me }) {
  const { data: categories } = useCategories();
  const updateMe = useUpdateMe();

  function toggle(id: string) {
    const interests = me.interests.includes(id) ? me.interests.filter((x) => x !== id) : [...me.interests, id];
    updateMe.mutate({ interests });
  }

  return (
    <View style={styles.section}>
      <Text weight="extrabold">What are you looking for?</Text>
      <Text size="sm" color={colors.inkSoft} style={styles.sub}>
        We&apos;ll show these first in your feed.
      </Text>
      <View style={styles.chips}>
        {categories?.map((c) => {
          const on = me.interests.includes(c.id);
          return (
            <Chip
              key={c.id}
              label={c.name}
              emoji={c.emoji}
              selected={on}
              leading={on ? <CheckIcon size={14} /> : undefined}
              onPress={() => toggle(c.id)}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24, paddingHorizontal: 16 },
  sub: { marginBottom: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
