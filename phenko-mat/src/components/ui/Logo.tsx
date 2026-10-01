import { StyleSheet, View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { colors } from "@/theme";
import { Text } from "./Text";

/*
 * The brand mark: an open box with a heart rising out of it (assets/brand/). Drawn on a 1024 grid, the
 * same as the app icon; the glyph is scaled up a touch inside the tile so it stays legible at header sizes.
 */
const HEART =
  "M0 70C-40 40-100 5-100-40C-100-75-72-100-45-100C-22-100-8-88 0-72C8-88 22-100 45-100C72-100 100-75 100-40C100 5 40 40 0 70Z";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Rect width={1024} height={1024} rx={230} fill={colors.honey} />
      <G transform="translate(512 512) scale(1.12) translate(-512 -512)" fill={colors.ink} stroke={colors.ink} strokeLinejoin="round">
        <Path d="M318 560H706V770H318Z" strokeWidth={70} />
        <Path d="M318 479L474 479L404 399L232 419Z" strokeWidth={44} />
        <Path d="M706 479L550 479L620 399L792 419Z" strokeWidth={44} />
        <Path d={HEART} stroke="none" transform="translate(512 315) rotate(-8) scale(1.2)" />
      </G>
    </Svg>
  );
}

export function Wordmark() {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Phenko Mat">
      <LogoMark />
      <Text weight="extrabold" size={21.6} style={styles.word}>
        phenko mat
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  word: { letterSpacing: -0.5 },
});
