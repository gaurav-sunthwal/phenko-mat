import * as Haptics from "expo-haptics";
import { router, usePathname, type Href } from "expo-router";
import type { ComponentType } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GridIcon, StackIcon, Text, UserIcon, type IconProps } from "@/components/ui";
import { alpha, colors, radius } from "@/theme";

const TABS: { href: Href & string; label: string; Icon: ComponentType<IconProps> }[] = [
  { href: "/feed", label: "Feed", Icon: StackIcon },
  { href: "/categories", label: "Categories", Icon: GridIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
];

/**
 * Web: <TabBar>. Custom (rather than the stock bar) so it matches the web exactly: a honey pill
 * behind the active icon. Chats is reachable from the header, so it has no tab of its own.
 */
export function TabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6) }]} accessibilityRole="tablist">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Pressable
            key={href}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            onPress={() => {
              if (active) return;
              void Haptics.selectionAsync();
              router.navigate(href);
            }}
            style={styles.tab}
          >
            <View style={[styles.iconPill, active && styles.iconPillActive]}>
              <Icon size={22} strokeWidth={active ? 2.4 : 2} color={active ? colors.ink : colors.inkSoft} />
            </View>
            <Text weight="bold" size="xs" color={active ? colors.ink : colors.inkSoft}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.line,
    backgroundColor: alpha(colors.white, 0.97),
  },
  tab: { flex: 1, alignItems: "center", gap: 4, paddingTop: 10, paddingBottom: 4 },
  iconPill: { width: 56, height: 32, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  iconPillActive: { backgroundColor: colors.honey },
});
