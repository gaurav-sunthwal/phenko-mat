import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, shadows } from "@/theme";
import { Text } from "./Text";

export interface SegmentedControlProps<T extends string> {
  /** `count` shows as a small badge after the label (e.g. how many items a tab holds). */
  options: readonly { value: T; label: string; count?: number }[];
  value: T | null;
  onChange: (value: T) => void;
  /** Colour of the selected pill (web uses ink for tabs, honey for "Condition"). */
  activeTone?: "ink" | "honey";
  style?: StyleProp<ViewStyle>;
  shadow?: boolean;
}

/** White rounded track with a filled pill on the selected option (web: `grid rounded-full bg-white p-1`). */
export function SegmentedControl<T extends string>({ options, value, onChange, activeTone = "ink", style, shadow }: SegmentedControlProps<T>) {
  return (
    <View style={[styles.track, shadow && shadows.sm, style]} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) void Haptics.selectionAsync();
              onChange(o.value);
            }}
            accessibilityLabel={o.count === undefined ? undefined : `${o.label}, ${o.count}`}
            style={[styles.segment, selected && { backgroundColor: activeTone === "ink" ? colors.ink : colors.honey }]}
          >
            <Text
              weight="bold"
              size="sm"
              numberOfLines={1}
              style={styles.label}
              color={selected ? (activeTone === "ink" ? colors.white : colors.ink) : colors.inkSoft}
            >
              {o.label}
            </Text>
            {o.count === undefined ? null : (
              <View style={[styles.count, { backgroundColor: selected ? colors.honey : colors.line }]}>
                <Text weight="extrabold" size="xs" color={colors.ink}>
                  {o.count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: radius.full,
    backgroundColor: colors.white,
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  label: { flexShrink: 1 },
  count: { minWidth: 20, paddingHorizontal: 6, borderRadius: radius.full, alignItems: "center" },
});
