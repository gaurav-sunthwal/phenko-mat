import { Image, type ImageProps } from "expo-image";
import { StyleSheet } from "react-native";
import { colors } from "@/theme";

export interface PhotoProps extends Omit<ImageProps, "source"> {
  uri: string | null | undefined;
  /** Web's `grayscale` class (given-away items). Approximated with a desaturating tint. */
  muted?: boolean;
}

/**
 * Fills its parent (like next/image `fill` + object-cover). expo-image gives memory + disk caching,
 * downsampling to the view size and a soft cross-fade.
 */
export function Photo({ uri, muted, style, transition = 180, ...rest }: PhotoProps) {
  return (
    <Image
      source={uri ? { uri } : undefined}
      contentFit="cover"
      transition={transition}
      cachePolicy="memory-disk"
      recyclingKey={uri ?? undefined}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.line }, muted && { opacity: 0.55 }, style]}
      {...rest}
    />
  );
}
