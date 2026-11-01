/**
 * Jest (jest-expo preset + React Native Testing Library).
 *
 * transformIgnorePatterns: jest-expo's default list plus every UI library that ships untranspiled
 * ESM/JSX/TS (NativeWind/css-interop, RN Reusables primitives, gluestack, legendapp motion,
 * Tamagui, Paper, lucide) and the workspace @bhw/* packages (TypeScript source).
 */
// Prefix matches (like jest-expo's default): "expo" also covers expo-*, "react-native" covers react-native-*.
const transpiled = [
  ".pnpm",
  "jest-react-native",
  "react-native",
  "@react-native",
  "@react-native-community",
  "expo",
  "@expo",
  "@expo-google-fonts",
  "react-navigation",
  "@react-navigation",
  "standard-navigation",
  "@sentry/react-native",
  "native-base",
  "react-native-svg",
  "nativewind",
  "react-native-css-interop",
  "@rn-primitives",
  "@gluestack-ui",
  "@legendapp",
  "tamagui",
  "@tamagui",
  "react-native-paper",
  "lucide-react-native",
  "@bhw",
];

const expoPreset = require("jest-expo/jest-preset");
const jsTransform = expoPreset.transform["\\.[jt]sx?$"];

/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Tamagui v3 ships some internals only as .mjs; reuse jest-expo's babel-jest config for them
  // (setting `transform` replaces the preset's map, so the preset entries are spread back in).
  transform: { ...expoPreset.transform, "\\.mjs$": jsTransform },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "node"],
  setupFiles: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    `/node_modules/(?!(${transpiled.join("|")}))`,
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/dist-check/"],
};
