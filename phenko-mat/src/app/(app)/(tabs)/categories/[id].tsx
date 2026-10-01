import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Text } from "@/components/ui";
import { useCategories } from "@/features/categories/api";
import { SwipeDeck } from "@/features/feed/components/SwipeDeck";
import { BackTitle } from "@/features/shell/ScreenTitle";

export default function CategoryDeck() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useCategories();
  const c = data?.find((x) => x.id === id);

  return (
    <View style={{ flex: 1 }}>
      <BackTitle
        fallback="/categories"
        accessibilityLabel="Back to categories"
        title={
          <Text weight="extrabold" size="xl" numberOfLines={1} accessibilityRole="header">
            {c ? `${c.emoji} ${c.name}` : " "}
          </Text>
        }
      />
      <SwipeDeck categoryId={id} />
    </View>
  );
}
