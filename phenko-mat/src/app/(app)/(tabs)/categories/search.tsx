import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { SwipeDeck } from "@/features/feed/components/SwipeDeck";
import { BackTitle } from "@/features/shell/ScreenTitle";

/** Search results as a swipe deck: `?q=sofa`. */
export default function SearchDeck() {
  const { q = "" } = useLocalSearchParams<{ q?: string }>();
  return (
    <View style={{ flex: 1 }}>
      <BackTitle title={`“${q}”`} fallback="/categories" accessibilityLabel="Back to browse" />
      <SwipeDeck key={q} query={q} />
    </View>
  );
}
