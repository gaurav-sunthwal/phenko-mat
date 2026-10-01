import type { ReactNode } from "react";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "@/theme";

/* 1:1 ports of phenko-mat-web/components/icons.tsx (24×24, round caps, 2px stroke). */

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Icon({ size = 24, color = colors.ink, strokeWidth = 2, fill = "none", children }: IconProps & { fill?: string; children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
    >
      {children}
    </Svg>
  );
}

export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="11" cy="11" r="7" />
    <Path d="m20 20-3.5-3.5" />
  </Icon>
);

export const HeartIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Icon {...p} fill={filled ? (p.color ?? colors.ink) : "none"}>
    <Path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </Icon>
);

export const StackIcon = (p: IconProps) => (
  <Icon {...p}>
    <Rect x="5" y="3" width="14" height="18" rx="3" />
    <Path d="M2 7v10M22 7v10" />
  </Icon>
);

export const GridIcon = (p: IconProps) => (
  <Icon {...p}>
    <Rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <Rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <Rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <Rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="12" cy="8" r="4" />
    <Path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
);

export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12Z" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 5v14M5 12h14" />
  </Icon>
);

export const PinIcon = ({ fill, ...p }: IconProps & { fill?: string }) => (
  <Icon {...p} fill={fill}>
    <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <Circle cx="12" cy="10" r="3" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M19 12H5M12 19l-7-7 7-7" />
  </Icon>
);

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m22 2-7 20-4-9-9-4Z" />
    <Path d="M22 2 11 13" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z" />
    <Circle cx="12" cy="13" r="3.5" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </Icon>
);

export const MoreIcon = ({ color = colors.ink, ...p }: IconProps) => (
  <Icon color={color} {...p}>
    <Circle cx="5" cy="12" r="1.5" fill={color} />
    <Circle cx="12" cy="12" r="1.5" fill={color} />
    <Circle cx="19" cy="12" r="1.5" fill={color} />
  </Icon>
);

export const LocateIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="12" cy="12" r="7" />
    <Circle cx="12" cy="12" r="2" />
    <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
);

/** Chevron-up — the web uses it as the "more info" affordance on cards. */
export const InfoIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m6 15 6-6 6 6" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="m6 9 6 6 6-6" />
  </Icon>
);

export const UndoIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 7v6h6" />
    <Path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
  </Icon>
);

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
  </Icon>
);

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7v5l3 2" />
  </Icon>
);

export function AppleLogo({ size = 18, color = colors.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M16.37 12.9c-.02-2.1 1.72-3.12 1.8-3.17-.98-1.44-2.51-1.64-3.05-1.66-1.3-.13-2.54.77-3.2.77-.66 0-1.68-.75-2.76-.73-1.42.02-2.73.83-3.46 2.1-1.48 2.56-.38 6.35 1.06 8.43.7 1.02 1.54 2.16 2.63 2.12 1.06-.04 1.46-.68 2.73-.68 1.28 0 1.64.68 2.76.66 1.14-.02 1.86-1.04 2.55-2.06.81-1.18 1.14-2.32 1.16-2.38-.03-.01-2.21-.85-2.22-3.4ZM14.3 6.73c.58-.7.97-1.68.86-2.65-.84.03-1.85.56-2.45 1.26-.54.62-1.01 1.62-.88 2.57.93.07 1.88-.47 2.47-1.18Z" />
    </Svg>
  );
}

export function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}
