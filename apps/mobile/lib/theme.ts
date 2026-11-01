/**
 * Theme adapters for the libraries that do NOT read Tailwind classes.
 *
 * Every value comes from @bhw/design-tokens (single source of truth):
 *  - NativeWind / RN Reusables / gluestack -> global.css CSS variables (scripts/gen-css-vars.mjs)
 *  - React Native Paper                    -> PAPER_THEME (MD3 theme merged with paperTheme())
 *  - Expo Router / React Navigation        -> NAV_THEME
 *  - Tamagui                               -> tamagui.config.ts
 */
import { colors, paperTheme, typography, type ThemeName } from "@bhw/design-tokens";
import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { configureFonts, MD3DarkTheme, MD3LightTheme, type MD3Theme } from "react-native-paper";

export type { ThemeName };

/** Normalises NativeWind's `colorScheme` (which can be undefined before first render) to a token theme. */
export function toThemeName(scheme: string | null | undefined): ThemeName {
  return scheme === "dark" ? "dark" : "light";
}

// Paper renders its own Text, so point every MD3 type-scale variant at the Inter faces
// loaded in app/_layout.tsx (Paper's default is the platform system font).
const paperFonts = configureFonts({
  config: { fontFamily: typography.mobileFonts.regular },
});

function buildPaperTheme(name: ThemeName): MD3Theme {
  const base = name === "dark" ? MD3DarkTheme : MD3LightTheme;
  const tokens = paperTheme(name);
  return {
    ...base,
    dark: tokens.dark,
    roundness: tokens.roundness,
    fonts: paperFonts,
    colors: { ...base.colors, ...tokens.colors },
  };
}

export const PAPER_THEME: Record<ThemeName, MD3Theme> = {
  light: buildPaperTheme("light"),
  dark: buildPaperTheme("dark"),
};

function buildNavTheme(name: ThemeName): Theme {
  const base = name === "dark" ? DarkTheme : DefaultTheme;
  const c = colors[name];
  return {
    ...base,
    colors: {
      ...base.colors,
      background: c.background,
      border: c.border,
      card: c.card,
      notification: c.destructive,
      primary: c.brand,
      text: c.foreground,
    },
  };
}

export const NAV_THEME: Record<ThemeName, Theme> = {
  light: buildNavTheme("light"),
  dark: buildNavTheme("dark"),
};
