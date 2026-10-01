import { Platform, type ViewStyle } from "react-native";

/*
 * Design tokens — mirror the web app's Tailwind theme (phenko-mat-web/app/globals.css) so both
 * clients look the same. Components read tokens; never hard-code a hex value in a screen.
 */

export const colors = {
  honey: "#FFC629",
  honeyDeep: "#F5B400",
  ink: "#1D1D1D",
  inkSoft: "#6B6B6B",
  cream: "#FFF5D6",
  paper: "#FBF8F1",
  line: "#ECE7DA",
  white: "#FFFFFF",
  black: "#000000",

  mint: "#B8E0D2",
  danger: "#B42318",
  dangerDeep: "#8A1C0B",
  dangerSoft: "#FFE4E0",
  success: "#146C2E",
  successSoft: "#DDF4E4",
  readTick: "#1D72F3",

  /** Avatar fallbacks, picked by a hash of the name (same order as web). */
  avatarTints: ["#FFC629", "#FFB5A7", "#B8E0D2", "#CDB4DB", "#A2D2FF", "#FFD6A5"],
} as const;

/** `rgba()` helper for translucent variants (e.g. ink/50 → alpha(colors.ink, 0.5)). */
export function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Plus Jakarta Sans, one family per weight (Android can't synthesise weights from one file). */
export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
  /** Jakarta tops out at 800; web's font-black renders as 800 too. */
  black: "PlusJakartaSans_800ExtraBold",
} as const;

export type FontWeight = keyof typeof fonts;

/** Tailwind's type scale (px). */
export const fontSize = {
  xs2: 10,
  xs1: 11,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  "5xl": 48,
} as const;

/** 4-pt spacing scale, named like Tailwind (space[4] = 16). */
export const space = (n: number) => n * 4;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  card: 22,
  tile: 24,
  sheet: 28,
  full: 999,
} as const;

function shadow(y: number, blur: number, opacity: number, color: string = colors.black, elevation = 4): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: { shadowColor: color, shadowOffset: { width: 0, height: y }, shadowOpacity: opacity, shadowRadius: blur / 2 },
    default: { elevation, shadowColor: color },
  })!;
}

export const shadows = {
  sm: shadow(1, 3, 0.08, colors.black, 1),
  button: shadow(8, 24, 0.22, colors.black, 6),
  honey: shadow(10, 28, 0.6, colors.honeyDeep, 8),
  card: shadow(18, 40, 0.4, colors.ink, 10),
  xl: shadow(12, 30, 0.2, colors.black, 12),
} as const;

export const motion = {
  /**
   * Web: 320ms cubic-bezier(0.2, 0.8, 0.3, 1) — a critically damped spring feels the same.
   * Critical damping is 2·√(stiffness·mass) ≈ 28; anything below that wobbles.
   */
  cardSpring: { damping: 30, stiffness: 220, mass: 0.9 },
  pressScale: 0.95,
  /** Press-down / release durations (ms) — web: `transition-transform` on `active:scale-95`. */
  pressInMs: 90,
  pressOutMs: 180,
  /** Enter animations for sheets and overlays (ms). */
  enterMs: 280,
} as const;

/** Content never grows wider than the web's phone column (tablets, web build). */
export const MAX_CONTENT_WIDTH = 480;
