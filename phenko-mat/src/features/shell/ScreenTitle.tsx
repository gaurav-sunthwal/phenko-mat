import { router, type Href } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { ArrowLeftIcon, IconButton, Text } from "@/components/ui";

/** Back button + title row used by nested screens (web: category deck, "List something"). */
export function BackTitle({ title, fallback, accessibilityLabel = "Back" }: { title: ReactNode; fallback: Href; accessibilityLabel?: string }) {
  return (
    <View style={styles.row}>
      <IconButton
        size={36}
        shadow
        icon={<ArrowLeftIcon size={18} />}
        accessibilityLabel={accessibilityLabel}
        onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      />
      {typeof title === "string" ? (
        <Text weight="extrabold" size="xl" numberOfLines={1} style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      ) : (
        title
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  title: { flex: 1 },
});
