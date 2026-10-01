import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { colors, radius } from "@/theme";
import { Text } from "./Text";

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emojiCircle}>
        <Text size={48}>{emoji}</Text>
      </View>
      <Text weight="extrabold" size="2xl" align="center" style={styles.title}>
        {title}
      </Text>
      <Text color={colors.inkSoft} align="center" leading={1.5} style={styles.body}>
        {body}
      </Text>
      {action}
    </View>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <View style={styles.spinner} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.honeyDeep} />
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.error} accessibilityRole="alert">
      <Text size="sm" color={colors.dangerDeep}>
        {message}
        {onRetry ? " " : ""}
      </Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
          <Text size="sm" weight="bold" color={colors.dangerDeep} style={styles.underline}>
            Try again
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Inline red validation / server message (web: `text-sm font-medium text-[#B42318]`). */
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Text size="sm" weight="medium" color={colors.danger} accessibilityRole="alert">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 48 },
  emojiCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.honey,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: { marginBottom: 8 },
  body: { marginBottom: 24, maxWidth: 320 },
  spinner: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  error: {
    margin: 16,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: colors.dangerSoft,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  underline: { textDecorationLine: "underline" },
});
