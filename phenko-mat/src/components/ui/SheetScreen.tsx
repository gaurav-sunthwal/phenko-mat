import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme";
import { IconButton } from "./IconButton";
import { XIcon } from "./icons";
import { Text } from "./Text";

/**
 * Body of a native form-sheet route (web: <Sheet>). Title row with a close button, then
 * keyboard-aware scrolling content. Native sheets don't render stack headers on Android, so the
 * header lives here.
 */
export function SheetScreen({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: Math.max(32, insets.bottom + 16) }]}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      <View style={styles.header}>
        <Text weight="extrabold" size="xl" accessibilityRole="header">
          {title}
        </Text>
        <IconButton
          icon={<XIcon size={20} />}
          accessibilityLabel="Close"
          background="transparent"
          onPress={onClose ?? (() => router.back())}
        />
      </View>
      {children}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.white },
  content: { padding: 24 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
});
