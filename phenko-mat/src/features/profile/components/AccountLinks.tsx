import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Avatar, Text } from "@/components/ui";
import { env } from "@/config/env";
import { useBlocked, useUnblock } from "@/features/safety/api";
import { LEGAL_LINKS, SITE } from "@/shared/site";
import { colors, radius } from "@/theme";

/** Help, legal pages (served by the web app) and contact, plus the blocked-people list. */
export function AccountLinks() {
  const open = (path: string) => void WebBrowser.openBrowserAsync(`${env.apiUrl}${path}`);
  return (
    <View style={styles.wrap}>
      <BlockedPeople />
      <View style={styles.card}>
        {LEGAL_LINKS.map((l) => (
          <Row key={l.href} label={l.label} onPress={() => open(l.href)} />
        ))}
        <Row label="Contact us" onPress={() => void Linking.openURL(`mailto:${SITE.supportEmail}`)} last />
      </View>
    </View>
  );
}

function Row({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && { backgroundColor: colors.cream }]}
      accessibilityRole="link"
    >
      <Text weight="semibold" size="sm">
        {label}
      </Text>
      <Text color={colors.inkSoft}>›</Text>
    </Pressable>
  );
}

/** People I've blocked, with Unblock. Hidden when there are none. */
function BlockedPeople() {
  const { data } = useBlocked();
  const unblock = useUnblock();
  const [open, setOpen] = useState(false);
  if (!data?.length) return null;
  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={styles.row}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text weight="semibold" size="sm">
          Blocked people ({data.length})
        </Text>
        <Text color={colors.inkSoft}>{open ? "⌃" : "⌄"}</Text>
      </Pressable>
      {open
        ? data.map((u) => (
            <View key={u.id} style={[styles.person, styles.dividerTop]}>
              <Avatar user={u} size={34} />
              <Text weight="bold" size="sm" numberOfLines={1} style={styles.flex}>
                {u.name}
              </Text>
              <Pressable onPress={() => void unblock(u.id)} style={styles.unblock} accessibilityRole="button" accessibilityLabel={`Unblock ${u.name}`}>
                <Text weight="bold" size="xs">
                  Unblock
                </Text>
              </Pressable>
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch", gap: 12, marginBottom: 12 },
  card: { borderRadius: radius.card, backgroundColor: colors.white, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
  dividerTop: { borderTopWidth: 1, borderTopColor: colors.line },
  person: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  flex: { flex: 1, minWidth: 0 },
  unblock: { borderWidth: 2, borderColor: colors.ink, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 4 },
});
