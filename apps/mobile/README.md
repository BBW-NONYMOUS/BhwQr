# @bhw/mobile — BHW Attendance (Expo)

Employee app for the BHW QR Attendance System. **Phase 2 scaffold only**: providers, theming, Supabase
client, config and tooling. Feature screens (Login, Bind Device, Home, Scan, History, …) come in Phase 5.

| | |
| --- | --- |
| Expo SDK | 58 (`expo` 58.0.22, React Native 0.88.1, React 19.3) |
| Router | Expo Router 58 (`app/` directory, typed routes) |
| Language | TypeScript strict |
| App name / scheme | BHW Attendance / `bhwqr://` |
| Android package / iOS bundle id | `ph.gov.kalawag2.bhwattendance` |

## Run it

From the repo root (pnpm workspace, hoisted `node_modules`):

```bash
pnpm install
cp apps/mobile/.env.example apps/mobile/.env   # then fill in the values (see "Environment")
pnpm dev:mobile                                 # or: pnpm --filter @bhw/mobile dev
```

Scan the QR code shown by `expo start`.

### Expo Go vs development build

- **Expo Go works for this scaffold and for most of Phase 5.** Every native module used here ships in
  Expo Go for SDK 58: `expo-camera` (barcode scanning), `expo-location`, `expo-secure-store`,
  `expo-local-authentication`, `expo-haptics`, `expo-network`, Reanimated/Worklets, Gesture Handler,
  Screens, SVG, Safe Area. NativeWind, React Native Reusables, gluestack UI, Paper and Tamagui are
  JavaScript-only (Tamagui runs without its babel compiler).
- **Use a development build** (`eas build --profile development`, or `npx expo run:android`) when you need:
  - the app's own permission texts, icon, splash, package id and `bhwqr://` deep links (Expo Go uses its own);
  - **Face ID on iOS** — Expo Go cannot declare this app's `NSFaceIDUsageDescription`, so
    `expo-local-authentication` falls back to the device passcode there (fingerprint on Android works);
  - any native library added later that is not part of Expo Go.

### Scripts

| Script | What it does |
| --- | --- |
| `pnpm --filter @bhw/mobile dev` | `expo start` |
| `pnpm --filter @bhw/mobile android` / `ios` | `expo start --android` / `--ios` |
| `pnpm --filter @bhw/mobile lint` | `expo lint` (eslint-config-expo flat config) |
| `pnpm --filter @bhw/mobile typecheck` | `tsc --noEmit` |
| `pnpm --filter @bhw/mobile test` | Jest (`jest-expo` preset + React Native Testing Library) |
| `pnpm --filter @bhw/mobile gen:css` | Regenerates `global.css` from `@bhw/design-tokens` |

Smoke-test that Metro bundles everything: `npx expo export --platform android --output-dir dist-check`
(then delete `dist-check/`). `npx expo-doctor` should report no issues.

## Environment

`apps/mobile/.env` (copy from `.env.example`):

| Variable | Example | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `http://192.168.1.10:54321` | On a **physical phone** use the dev PC's **LAN IP** (`ipconfig`), not `127.0.0.1`/`localhost` (that is the phone itself). Android emulator: `http://10.0.2.2:54321`. Production: `https://<ref>.supabase.co`. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | from `supabase status` | Public anon key; RLS protects the data. |

`EXPO_PUBLIC_*` values are **inlined into the JS bundle and are not secret**. Never put the service-role
key, the QR HMAC secret or any server-only value in this app. `lib/env.ts` validates both variables with
zod the first time the Supabase client is created and throws a readable error if they are missing.

## Mobile UI library strategy

All five libraries are used, but each has ONE job so they do not conflict. Document this table in the README.

| Library                          | Role                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **NativeWind**             | Styling foundation: all layout, spacing, color, typography via Tailwind classes, sharing tokens with web                          |
| **React Native Reusables** | Primary components (shadcn port): Button, Card, Input, Label, Avatar, Badge, Tabs, Dialog, Separator, Progress, Text              |
| **gluestack UI v2**        | Toast, Actionsheet, FormControl with validation messages, Spinner, Skeleton                                                       |
| **React Native Paper**     | FAB (Scan button), Snackbar (offline notice), SegmentedButtons (history filter) only; PaperProvider theme mapped to shared tokens |
| **Tamagui**                | Animated scan result overlay and attendance detail bottom sheet only; Tamagui config mapped to shared tokens                      |

Rules:

- Never use two libraries for the same component type.
- Define palette, radius and fonts ONCE in `packages/design-tokens` and map into Tailwind (web + NativeWind), Paper theme and Tamagui config.
- Light and dark mode on both platforms.
- If a library combination causes build/runtime errors, explain the error and propose the smallest fix instead of silently removing the library.

Where each library lives:

| Library | Location | How it was added |
| --- | --- | --- |
| NativeWind 4 + Tailwind CSS 3.4 | `tailwind.config.js`, `global.css`, `babel.config.js`, `metro.config.js`, `nativewind-env.d.ts` | npm (NativeWind v4 requires Tailwind v3) |
| React Native Reusables | `components/ui/*` (+ `components.json`, `lib/utils.ts`) | `npx @react-native-reusables/cli add … --styling-library nativewind` |
| gluestack UI v2 | `components/gluestack/*` | Copied from the gluestack v2 NativeWind sources; classes remapped to our tokens (see below) |
| React Native Paper 5 | `PaperProvider` in `app/_layout.tsx`, theme in `lib/theme.ts` | npm; icons via `@expo/vector-icons` (Paper picks it up automatically) |
| Tamagui 3 | `tamagui.config.ts`, `TamaguiProvider` in `app/_layout.tsx` | npm, runtime only (no `@tamagui/babel-plugin`) |

gluestack UI v2 components are kept in `components/gluestack/` so their names never clash with RN
Reusables in `components/ui/`. Their original palette classes (`bg-background-0`, `text-typography-900`,
`border-outline-100`, …) were replaced with the shared token classes (`bg-card`, `text-foreground`,
`border-border`, …), and the provider no longer ships its own `vars()` palette or calls
`setColorScheme` (the app theme context owns the scheme).

## Provider nesting (`app/_layout.tsx`)

Outer → inner. The same explanation is in the comment block in `app/_layout.tsx`.

```
GestureHandlerRootView
└─ SafeAreaProvider
   └─ QueryClientProvider
      └─ AppThemeProvider            (scheme = NativeWind useColorScheme)
         └─ TamaguiProvider + <Theme name={scheme}>
            └─ PaperProvider          (PAPER_THEME[scheme])
               └─ GluestackUIProvider (mode={scheme}: OverlayProvider + ToastProvider)
                  └─ ThemeProvider    (NAV_THEME[scheme], from expo-router)
                     ├─ <Stack />
                     ├─ <StatusBar />
                     └─ <PortalHost />   (last child → RN Reusables portals render on top)
```

1. **GestureHandlerRootView** — must wrap everything that receives gestures (Tamagui Sheet, gluestack
   Actionsheet, RN Reusables dialogs, Paper ripples); outermost so no provider overlay escapes it.
2. **SafeAreaProvider** — insets are read by Paper, Tamagui Sheet, gluestack Toast and the navigator.
3. **QueryClientProvider** — data only, no theme; above the theme so a light/dark switch never remounts the cache.
4. **AppThemeProvider** (`lib/app-theme.tsx`) — the single color-scheme source. NativeWind's
   `useColorScheme` follows the phone setting and flips the `.dark` CSS variables; every provider below
   receives the same `scheme`, so the five libraries can never disagree.
5. **TamaguiProvider** — Sheet portals need Tamagui's theme context; above Paper/gluestack so a Tamagui
   sheet can contain their components (never the other way round).
6. **PaperProvider** — MD3 theme merged with the tokens; hosts Paper's Portal for FAB/Snackbar.
7. **GluestackUIProvider** — OverlayProvider + ToastProvider, directly around the navigator so toasts
   and actionsheets stack above screen content and may contain Paper/Tamagui components.
8. **ThemeProvider** (navigation) — only the navigator reads it, so it is innermost.
9. **Stack, StatusBar, PortalHost** — `PortalHost` (`@rn-primitives/portal`) is the last child so RN
   Reusables portals (Dialog, …) paint above everything else.

Fonts: Inter 400/500/600/700 are loaded with `useFonts` (per-weight imports from
`@expo-google-fonts/inter`) and the native splash screen stays up until they are ready.

## Token flow (single source of truth)

```
packages/design-tokens/src/tokens.ts
 ├─ tailwind-preset.cjs (generated) ─┬─► tailwind.config.js presets → NativeWind classes (bg-card, text-brand, rounded-2xl…)
 │   colorsLight / colorsDark ───────┴─► scripts/gen-css-vars.mjs → global.css  (:root = light, .dark:root = dark, RGB triplets)
 ├─ paperTheme()  ─────────────────────► lib/theme.ts PAPER_THEME (MD3Light/Dark + tokens, Inter fonts)
 ├─ colors ────────────────────────────► lib/theme.ts NAV_THEME   (expo-router DefaultTheme/DarkTheme + tokens)
 └─ tamaguiTokens / tamaguiThemes ─────► tamagui.config.ts        (stock v5 config + token overrides)
```

- The preset maps each color to `rgb(var(--token) / <alpha-value>)`; `gen-css-vars.mjs` writes the
  variables as space-separated RGB triplets so opacity modifiers (`bg-brand/20`) work.
  **After changing tokens, run `pnpm --filter @bhw/design-tokens build` (regenerates the preset) and
  then `pnpm --filter @bhw/mobile gen:css`.** Never edit `global.css` by hand.
- Radius: `rounded-md` = 6px (inputs/buttons), `rounded-2xl` = 16px (mobile cards — the RN Reusables
  Card was changed from `rounded-xl` to `rounded-2xl`), `rounded-full` for badges.
- Fonts: the preset maps `font-sans/medium/semibold/bold` to the Inter faces, so `font-semibold`
  picks `Inter_600SemiBold` on Android and iOS. RN Reusables `Text` has `font-sans` in its base class.
- Tamagui v3 reserves the `true` token key, so `tamagui.config.ts` drops the `true` entries that
  `@bhw/design-tokens` still exposes. Tamagui v3 style props are shorthands (`bg`, `px`, `rounded`, …)
  and tokens are referenced without `$` (`bg="brand"`).

## Supabase client (`lib/supabase.ts`)

- `getSupabase()` creates the client lazily with `autoRefreshToken`, `persistSession`,
  `detectSessionInUrl: false` and an `AppState` listener that calls `startAutoRefresh` /
  `stopAutoRefresh` when the app enters the foreground / background.
- Sessions are stored in **expo-secure-store** (Keychain / Android Keystore). SecureStore is limited to
  ~2048 bytes per value, so values are split into 1800-character chunks (`key` holds a
  `__chunks__:<n>` manifest, `key.0 … key.n-1` hold the data); stale chunks are removed when a session
  shrinks or on sign-out. Covered by `lib/supabase.test.ts`.

## EAS (`eas.json`)

| Profile | Distribution | Android artifact | EAS Update channel |
| --- | --- | --- | --- |
| `development` | internal, `developmentClient: true` | APK | `development` |
| `preview` | internal | APK | `preview` |
| `production` | store, `autoIncrement` (remote app version) | AAB | `production` |

`runtimeVersion` uses the `appVersion` policy. To actually ship OTA updates, add `expo-updates`
(`npx expo install expo-updates`) and run `eas update:configure` (it writes `updates.url` /
`extra.eas.projectId` after `eas init`).

## Tests

`jest.config.js` uses the `jest-expo` preset; `transformIgnorePatterns` also lets Babel transform
NativeWind/css-interop, `@rn-primitives`, `@gluestack-ui`, `@legendapp`, Tamagui, Paper, lucide and the
`@bhw/*` workspace packages, and `.mjs` files (some Tamagui internals). `jest.setup.js` mocks
`expo-secure-store` (in memory) and the Paper icon font, and adds `window.screen` for react-aria.

- `lib/env.test.ts` — env validation.
- `lib/supabase.test.ts` — SecureStore chunking.
- `__tests__/home.test.tsx` — renders the scaffold screen inside the Tamagui + Paper + gluestack
  providers and checks the RN Reusables card, the Tamagui badge, the Paper FAB and the gluestack toast.

Tests live outside `app/` because every file in `app/` becomes a route.

## Known caveats

- gluestack UI v2 packages (`@gluestack-ui/toast` 1.0.9, `actionsheet` 0.2.53, `overlay` 0.1.22, …) were
  last published in early 2025. They work on RN 0.88, but `ToastList` still uses React Native's
  deprecated `SafeAreaView` (a console warning only). If they break on a future SDK, the smallest fix is
  gluestack's v3 line (`@gluestack-ui/core` + `@gluestack-ui/utils`), which keeps the same copy-in API;
  note that gluestack's newest line targets NativeWind v5 / Tailwind v4, which this app cannot use yet.
- Tamagui uses the React Native `Animated` driver (`@tamagui/config/v5-rn`). If the Phase 5 scan overlay
  needs UI-thread springs, switch to `@tamagui/config/v5-reanimated`.

## Phase 5 – screens

| Route | Screen | Libraries |
| --- | --- | --- |
| `app/(auth)/login.tsx` | Login (EN/FIL toggle) | RN Reusables, gluestack FormControl |
| `app/(auth)/blocked.tsx` | Pending / rejected / inactive / wrong phone | RN Reusables |
| `app/(auth)/bind-device.tsx` | First-login phone binding | RN Reusables, gluestack Spinner |
| `app/(tabs)/index.tsx` | Home: today, week progress, recent, notifications, **Paper FAB Scan** | RN Reusables, Paper FAB, gluestack Skeleton |
| `app/scan.tsx` | Health check sheet → camera → **Tamagui result overlay** + haptics | gluestack Actionsheet, expo-camera, Tamagui |
| `app/(tabs)/history.tsx` | **Paper SegmentedButtons** filter, **Tamagui detail sheet**, request correction | Paper, Tamagui Sheet |
| `app/correction/new.tsx` | Correction request (type via gluestack Actionsheet, attachment) | gluestack FormControl/Actionsheet/Toast |
| `app/requests.tsx` | My Requests (cancel pending) | RN Reusables Dialog |
| `app/dtr.tsx` | My DTR (31 rows, totals, PDF download + share) | RN Reusables |
| `app/(tabs)/my-qr.tsx` | Rotating personal QR for admin fallback | react-native-qrcode-svg, RN Reusables Progress |
| `app/(tabs)/profile.tsx` | Profile, theme, biometric unlock, language, logout | RN Reusables |
| `app/privacy.tsx` | Data Privacy Notice EN/FIL | RN Reusables Tabs |

App-wide: **Paper Snackbar** offline notice; `lib/session.tsx` auth gate (AC-01: pending/rejected/inactive
accounts never reach the tabs); scans are never queued offline (see `app/scan.tsx`).

### Trying it on a phone

1. `pnpm dev:mobile`, scan the QR with Expo Go (same Wi-Fi as the PC).
2. Pick a demo BHW (password `BhwDemo#2026`) and, signed in to the web portal as `admin@bhw.local`,
   open Admin → Employees → that BHW → **Reset device** (every demo BHW already has a seeded or test
   device bound). Then sign in on the phone: the first login binds it. Without the reset the app shows
   "Phone not registered to you" — that is the device-binding rule working.
3. Open `http://<pc-ip>:3000/kiosk` on a tablet/PC signed in as `kiosk@bhw.local`, then scan from the app.
   The geofence is 100 m around the seeded station (6.6311, 124.6047, Isulan); to test elsewhere, edit the
   station coordinates in Admin → Stations & Kiosks (use "Use my location").

## Test APK (EAS cloud build)

The `preview` profile in `eas.json` builds a standalone APK (JS bundled, no dev server) that talks to the
hosted dev project. It carries only the public Supabase URL and anon key. The repo has no git yet, so tell
EAS to upload the workspace folder directly (it still skips everything in `.gitignore`, including secrets):

```powershell
npx eas login                       # once, free account at expo.dev
$env:EAS_NO_VCS = "1"; $env:EAS_PROJECT_ROOT = "C:\Users\User\Documents\BhwQr"
npx eas build -p android --profile preview
```

Answer **Yes** to "create an EAS project" and "generate a new Android Keystore". When the build finishes,
open the link (or scan its QR) on the phone, download the APK and allow "install unknown apps".
The Register button opens `EXPO_PUBLIC_WEB_URL`; add it to the profile's `env` once the portal has a public address.
