/**
 * Design tokens for the BHW QR Attendance System.
 * Visual reference (development.md): shadcn neutral (zinc) palette, health-teal accent,
 * Inter font, 6px controls, 12px web cards, 16px mobile cards, full-round badges.
 *
 * Every platform adapter (Tailwind v4 CSS, Tailwind v3 preset for NativeWind,
 * React Native Paper theme, Tamagui config) reads from this file only.
 */

export type ThemeName = "light" | "dark";

export interface ColorScheme {
  background: string;
  backgroundSubtle: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  /** Health teal brand accent (#0f766e). Used for the scan viewfinder, FAB and highlights. */
  brand: string;
  brandForeground: string;
  /** Warnings that are not errors (clock drift, cooldown, late). */
  warning: string;
  warningForeground: string;
  /** Positive state (kiosk online, saved). */
  success: string;
  successForeground: string;
}

export const colors: Record<ThemeName, ColorScheme> = {
  light: {
    background: "#ffffff",
    backgroundSubtle: "#fafafa",
    foreground: "#09090b",
    card: "#ffffff",
    cardForeground: "#09090b",
    popover: "#ffffff",
    popoverForeground: "#09090b",
    primary: "#18181b",
    primaryForeground: "#fafafa",
    secondary: "#f4f4f5",
    secondaryForeground: "#18181b",
    muted: "#f4f4f5",
    mutedForeground: "#71717a",
    accent: "#f4f4f5",
    accentForeground: "#18181b",
    destructive: "#dc2626",
    destructiveForeground: "#fafafa",
    border: "#e4e4e7",
    input: "#e4e4e7",
    ring: "#0f766e",
    brand: "#0f766e",
    brandForeground: "#ffffff",
    warning: "#b45309",
    warningForeground: "#ffffff",
    success: "#15803d",
    successForeground: "#ffffff",
  },
  dark: {
    background: "#09090b",
    backgroundSubtle: "#0c0c0e",
    foreground: "#fafafa",
    card: "#18181b",
    cardForeground: "#fafafa",
    popover: "#18181b",
    popoverForeground: "#fafafa",
    primary: "#fafafa",
    primaryForeground: "#18181b",
    secondary: "#27272a",
    secondaryForeground: "#fafafa",
    muted: "#27272a",
    mutedForeground: "#a1a1aa",
    accent: "#27272a",
    accentForeground: "#fafafa",
    destructive: "#ef4444",
    destructiveForeground: "#fafafa",
    border: "#27272a",
    input: "#27272a",
    ring: "#14b8a6",
    brand: "#14b8a6",
    brandForeground: "#042f2e",
    warning: "#f59e0b",
    warningForeground: "#1c1917",
    success: "#22c55e",
    successForeground: "#052e16",
  },
};

/** Attendance status badge colors (background / foreground). Same in both themes for recognisability. */
export const statusColors = {
  on_time: { bg: "#dcfce7", fg: "#166534", label: "On time", labelFil: "Nasa oras" },
  late: { bg: "#fef3c7", fg: "#92400e", label: "Late", labelFil: "Huli" },
  absent: { bg: "#fee2e2", fg: "#991b1b", label: "Absent", labelFil: "Liban" },
  incomplete: { bg: "#f4f4f5", fg: "#3f3f46", label: "No time-out", labelFil: "Walang time-out" },
  undertime: { bg: "#ffedd5", fg: "#9a3412", label: "Undertime", labelFil: "Kulang sa oras" },
} as const;

export type AttendanceStatusToken = keyof typeof statusColors;

export const radius = {
  /** Inputs and buttons. */
  control: 6,
  /** Web cards. */
  cardWeb: 12,
  /** Mobile cards. */
  cardMobile: 16,
  /** Badges and pills. */
  full: 9999,
} as const;

export const typography = {
  fontFamily: "Inter",
  fontFamilyFallback: [
    "Inter",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "sans-serif",
  ],
  /** Expo font names loaded with @expo-google-fonts/inter. */
  mobileFonts: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
  size: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 36 },
} as const;

/** Minimum touch target (UX rule: >= 44px). */
export const touchTarget = 44;
