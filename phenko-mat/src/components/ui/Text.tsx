import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { colors, fonts, fontSize, type FontWeight } from "@/theme";

export interface TextProps extends RNTextProps {
  weight?: FontWeight;
  size?: keyof typeof fontSize | number;
  color?: string;
  align?: "left" | "center" | "right";
  /** Line height as a multiple of the font size. */
  leading?: number;
}

/** The only text primitive: applies the brand font per weight and the Tailwind type scale. */
export function Text({ weight = "regular", size = "base", color = colors.ink, align, leading, style, ...rest }: TextProps) {
  const px = typeof size === "number" ? size : fontSize[size];
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      {...rest}
      style={[
        { fontFamily: fonts[weight], fontSize: px, color, textAlign: align },
        leading !== undefined && { lineHeight: Math.round(px * leading) },
        style,
      ]}
    />
  );
}
