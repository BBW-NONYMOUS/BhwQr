/**
 * Tamagui config (Tamagui v3, runtime-only: no @tamagui/babel-plugin / static compiler).
 *
 * Tamagui has ONE job in this app (development.md, Mobile UI library strategy):
 * the animated scan-result overlay and the attendance detail bottom sheet (Phase 5).
 * It starts from the stock v5 config so Sheet and friends get every theme key they read,
 * then overrides colors, radius, spacing and fonts with @bhw/design-tokens.
 */
import { tamaguiFontFamily, tamaguiThemes, tamaguiTokens } from "@bhw/design-tokens";
import { createSystemFont, defaultConfig } from "@tamagui/config/v5";
import { animationsReactNative } from "@tamagui/config/v5-rn";
import { createTamagui, createTokens } from "tamagui";

// React Native Animated driver: no extra native module, works in Expo Go and in jest.
// (Swap to "@tamagui/config/v5-reanimated" in Phase 5 if the overlay needs UI-thread springs.)
const animations = animationsReactNative;

const interFace = {
  400: { normal: tamaguiFontFamily.regular },
  500: { normal: tamaguiFontFamily.medium },
  600: { normal: tamaguiFontFamily.semibold },
  700: { normal: tamaguiFontFamily.bold },
};

const body = createSystemFont({ family: tamaguiFontFamily.regular, font: { face: interFace } });
const heading = createSystemFont({ family: tamaguiFontFamily.semibold, font: { face: interFace } });

/**
 * Tamagui v3 reserves the `true` token key (boolean props now select component defaults) and throws
 * "tokens.radius.true is reserved" at startup. @bhw/design-tokens still exposes v1-style `true` keys,
 * so they are dropped here; the stock v5 defaults fill that role.
 */
function withoutTrueKey<T extends Record<string, unknown>>(scale: T): Omit<T, "true"> {
  const { true: _ignored, ...rest } = scale;
  return rest;
}

const tokens = createTokens({
  ...defaultConfig.tokens,
  color: tamaguiTokens.color,
  radius: { ...defaultConfig.tokens.radius, ...withoutTrueKey(tamaguiTokens.radius) },
  space: { ...defaultConfig.tokens.space, ...withoutTrueKey(tamaguiTokens.space) },
  size: { ...defaultConfig.tokens.size, ...withoutTrueKey(tamaguiTokens.size) },
  zIndex: { ...defaultConfig.tokens.zIndex, ...tamaguiTokens.zIndex },
});

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  animations,
  tokens,
  fonts: { ...defaultConfig.fonts, body, heading },
  themes: {
    ...defaultConfig.themes,
    light: { ...defaultConfig.themes.light, ...tamaguiThemes.light },
    dark: { ...defaultConfig.themes.dark, ...tamaguiThemes.dark },
  },
});

export default tamaguiConfig;

export type AppTamaguiConfig = typeof tamaguiConfig;

declare module "tamagui" {
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}
