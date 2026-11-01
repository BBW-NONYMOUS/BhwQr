import { colors, radius, typography } from "./tokens.ts";

/**
 * Inputs for Tamagui createTokens / themes in apps/mobile/tamagui.config.ts.
 * Tamagui is only used for the animated scan-result overlay and the attendance detail sheet,
 * so only the tokens those components need are exposed.
 */
export const tamaguiTokens = {
  color: {
    brand: colors.light.brand,
    brandDark: colors.dark.brand,
    zinc50: "#fafafa",
    zinc100: "#f4f4f5",
    zinc200: "#e4e4e7",
    zinc500: "#71717a",
    zinc800: "#27272a",
    zinc900: "#18181b",
    zinc950: "#09090b",
    success: "#166534",
    successBg: "#dcfce7",
    warning: "#92400e",
    warningBg: "#fef3c7",
    danger: "#991b1b",
    dangerBg: "#fee2e2",
  },
  radius: {
    0: 0,
    1: radius.control,
    2: radius.cardWeb,
    3: radius.cardMobile,
    4: 24,
    full: radius.full,
  },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 },
  size: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 11: 44, 12: 48 },
  zIndex: { 0: 0, 1: 100, 2: 200, 3: 300, 4: 400, 5: 500 },
} as const;

export const tamaguiThemes = {
  light: {
    background: colors.light.background,
    backgroundStrong: colors.light.card,
    color: colors.light.foreground,
    colorMuted: colors.light.mutedForeground,
    borderColor: colors.light.border,
    brand: colors.light.brand,
  },
  dark: {
    background: colors.dark.background,
    backgroundStrong: colors.dark.card,
    color: colors.dark.foreground,
    colorMuted: colors.dark.mutedForeground,
    borderColor: colors.dark.border,
    brand: colors.dark.brand,
  },
} as const;

export const tamaguiFontFamily = typography.mobileFonts;
