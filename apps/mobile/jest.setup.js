/* global jest */
// In-memory expo-secure-store so storage logic can be unit tested without a device keychain.
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    AFTER_FIRST_UNLOCK: 0,
    getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
    __store: store,
  };
});

// react-aria (pulled in by gluestack v2 overlays) runs a test-only polyfill that calls
// Reflect.has(window.screen, ...). The React Native jest environment has `window` but no `screen`.
if (typeof window !== "undefined" && typeof window.screen !== "object") {
  window.screen = {};
}

// @expo/vector-icons loads its font through expo-asset, which has no asset registry under jest.
// Paper's FAB icon resolves to MaterialCommunityIcons, so render the glyph name as plain text.
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => {
  const { Text } = require("react-native");
  const Icon = ({ name, ...props }) => require("react").createElement(Text, props, name);
  return { __esModule: true, default: Icon };
});
