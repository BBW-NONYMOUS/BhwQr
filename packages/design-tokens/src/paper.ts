import { colors, radius, type ThemeName } from "./tokens.ts";

/**
 * Plain object merged into React Native Paper's MD3 theme in the mobile app.
 * Kept dependency-free so this package does not depend on react-native-paper.
 */
export function paperTheme(name: ThemeName) {
  const c = colors[name];
  return {
    dark: name === "dark",
    roundness: radius.control,
    colors: {
      primary: c.brand,
      onPrimary: c.brandForeground,
      primaryContainer: c.brand,
      onPrimaryContainer: c.brandForeground,
      secondary: c.primary,
      onSecondary: c.primaryForeground,
      secondaryContainer: c.secondary,
      onSecondaryContainer: c.secondaryForeground,
      background: c.background,
      onBackground: c.foreground,
      surface: c.card,
      onSurface: c.cardForeground,
      surfaceVariant: c.muted,
      onSurfaceVariant: c.mutedForeground,
      outline: c.border,
      outlineVariant: c.border,
      error: c.destructive,
      onError: c.destructiveForeground,
      inverseSurface: c.primary,
      inverseOnSurface: c.primaryForeground,
      inversePrimary: c.brand,
    },
  };
}
