// NativeWind v4 setup for Expo SDK 58.
// - babel-preset-expo with jsxImportSource "nativewind" makes every JSX element accept `className`.
// - "nativewind/babel" adds the css-interop transform and "react-native-reanimated/plugin"
//   (which on Reanimated 4 forwards to "react-native-worklets/plugin").
// - babel-preset-expo also auto-adds the worklets plugin when react-native-worklets is installed,
//   so no extra plugin is listed here (adding it again would run it twice).
// - Tamagui runs runtime-only (no @tamagui/babel-plugin static compiler) to keep the build simple.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
