// NativeWind v4 requires Tailwind CSS v3.
// Colors, radius and fonts come ONLY from @bhw/design-tokens (shared with the web app):
// the preset maps every color to `rgb(var(--token) / <alpha-value>)`, and the CSS variables
// themselves are generated into global.css by scripts/gen-css-vars.mjs (light in :root, dark in .dark).
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset"), require("@bhw/design-tokens/tailwind-preset")],
  theme: {
    extend: {},
  },
  // tailwindcss-animate: web-only enter/exit classes used by React Native Reusables (Dialog, etc.).
  plugins: [require("tailwindcss-animate")],
};
