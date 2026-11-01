// Metro config for a pnpm (hoisted) monorepo.
// Since SDK 52, expo/metro-config detects the workspace root and configures watchFolders and
// nodeModulesPaths automatically, so no manual monorepo settings are needed here.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// inlineRem 16: React Native Reusables sizes assume 1rem = 16px (NativeWind default is 14).
module.exports = withNativeWind(config, { input: "./global.css", inlineRem: 16 });
