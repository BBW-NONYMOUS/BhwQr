import "../global.css";

// Per-weight subpath imports: the package index would bundle all 18 Inter faces (~6 MB).
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { useFonts } from "expo-font";
import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, ThemeProvider, useRootNavigationState, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { TamaguiProvider, Theme } from "tamagui";

import { GluestackUIProvider } from "@/components/gluestack/gluestack-ui-provider";
import { OfflineSnackbar } from "@/components/home/offline-snackbar";
import { AppThemeProvider, useAppTheme } from "@/lib/app-theme";
import { PreferencesProvider } from "@/lib/preferences";
import { createQueryClient } from "@/lib/query-client";
import { SessionProvider, useSession, type Gate } from "@/lib/session";
import { NAV_THEME, PAPER_THEME } from "@/lib/theme";
import { tamaguiConfig } from "@/tamagui.config";

export { ErrorBoundary } from "expo-router";

// Keep the native splash screen up until the Inter fonts are ready AND the auth gate is decided
// (avoids a flash of system font and a flash of the wrong screen).
void SplashScreen.preventAutoHideAsync();

/** Upper bound for the splash while the session is checked on a very slow network. */
const SPLASH_MAX_MS = 8000;

/*
 * PROVIDER NESTING ORDER (outer -> inner) and why each level sits where it does
 * ----------------------------------------------------------------------------
 * 1. GestureHandlerRootView  Must wrap EVERYTHING that can receive gestures: Tamagui Sheet drag,
 *                            gluestack Actionsheet, RN Reusables dialogs, Paper ripples. Outermost
 *                            so no overlay created by a provider below escapes the gesture root.
 * 2. SafeAreaProvider        Measures insets once. Paper, Tamagui Sheet, gluestack Toast and the
 *                            native stack all read insets, so it must sit above all of them.
 * 3. QueryClientProvider     Pure data layer: no UI, no theme. Above the theme so switching
 *                            light/dark never re-creates or remounts the query cache.
 * 4. AppThemeProvider        The single color-scheme source (NativeWind useColorScheme). Every
 *                            library provider below receives its theme from here, so the five
 *                            libraries can never disagree about light/dark.
 *    4a. PreferencesProvider Language, biometric unlock and theme preference (SecureStore). Needs
 *                            AppThemeProvider (it restores the saved scheme); no UI of its own.
 *    4b. SessionProvider     Supabase session -> profile -> device binding -> `gate` (core flow 2).
 *                            Data only, so it sits with the other non-UI providers, above every
 *                            UI library provider; screens and the gate redirect read it.
 * 5. TamaguiProvider + Theme Tamagui only renders the scan overlay / detail sheet, but Sheet portals
 *                            need its theme context; it sits above Paper/gluestack so a Tamagui
 *                            Sheet can host their components (Paper/gluestack never host Tamagui).
 * 6. PaperProvider           MD3 theme merged with @bhw/design-tokens. Paper's own Portal host
 *                            lives here, so FAB / Snackbar render inside the themed tree.
 * 7. GluestackUIProvider     OverlayProvider + ToastProvider. Inside Tamagui/Paper so a toast or
 *                            actionsheet may contain their components, and directly around the
 *                            navigator so its overlays stack above screen content.
 * 8. ThemeProvider (nav)     Expo Router / React Navigation colors (screen + header background).
 *                            Innermost provider because only the navigator reads it.
 * 9. Stack, OfflineSnackbar, StatusBar, PortalHost
 *                            The Stack hosts the route groups; GateRedirect (a hook in AppStack)
 *                            sends the user to Login / Blocked / Bind Device / tabs. The Paper
 *                            offline Snackbar is app-wide. PortalHost (@rn-primitives/portal, used
 *                            by RN Reusables Dialog and friends) is the LAST child so its portals
 *                            paint above the navigator and above every other overlay.
 */
export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // On a font error we still render (system font fallback) instead of hanging on the splash screen.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider>
            <PreferencesProvider>
              <SessionProvider>
                <ThemedProviders />
              </SessionProvider>
            </PreferencesProvider>
          </AppThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedProviders() {
  const { scheme, isDark } = useAppTheme();

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={scheme}>
      <Theme name={scheme}>
        <PaperProvider theme={PAPER_THEME[scheme]}>
          <GluestackUIProvider mode={scheme}>
            <ThemeProvider value={NAV_THEME[scheme]}>
              <AppStack />
              <OfflineSnackbar />
              <StatusBar style={isDark ? "light" : "dark"} />
              <PortalHost />
            </ThemeProvider>
          </GluestackUIProvider>
        </PaperProvider>
      </Theme>
    </TamaguiProvider>
  );
}

function AppStack() {
  useGateRedirect();

  // Screens set their own header/title with <Stack.Screen options> (correction/new, requests,
  // dtr, privacy); the tabs and auth groups draw their own chrome.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      {/* Camera is mounted only on this screen (low-end Android); full-screen, dark. */}
      <Stack.Screen name="scan" options={{ presentation: "fullScreenModal", animation: "fade" }} />
      <Stack.Screen name="correction/new" />
      <Stack.Screen name="requests" />
      <Stack.Screen name="dtr" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}

/** Where a gate state lives. `null` = the tabs (and every signed-in screen). */
function authScreenFor(gate: Gate): "login" | "blocked" | "bind-device" | null {
  switch (gate.kind) {
    case "signed_out":
      return "login";
    case "blocked":
      return "blocked";
    case "needs_binding":
      return "bind-device";
    default:
      return null;
  }
}

/**
 * Auth guard (docs/phase-5-mobile §3): loading → keep the splash; signed_out → Login;
 * blocked → Blocked; needs_binding → Bind Device; ready → tabs. Runs on every gate change
 * and every navigation, so a deep link can never open a signed-in screen early.
 */
function useGateRedirect() {
  const { gate } = useSession();
  const segments = useSegments() as string[];
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const loading = gate.kind === "loading";

  // Splash: hide once the gate is decided (or after SPLASH_MAX_MS so a slow network never traps it).
  useEffect(() => {
    if (!loading) {
      void SplashScreen.hideAsync();
      return;
    }
    const timer = setTimeout(() => void SplashScreen.hideAsync(), SPLASH_MAX_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  const [group, screen] = segments;
  useEffect(() => {
    // app/index.tsx (no segments) renders its own <Redirect> for the same gate.
    if (!navigationReady || loading || group === undefined) return;
    const target = authScreenFor(gate);

    if (target === null) {
      // Signed in and ready: leave the auth screens for the tabs.
      if (group === "(auth)") router.replace("/(tabs)");
      return;
    }
    // Privacy notice stays readable before sign-in (it is linked from registration on the web too).
    if (group === "privacy") return;
    if (group !== "(auth)" || screen !== target) router.replace(`/(auth)/${target}`);
  }, [gate, group, screen, navigationReady, loading]);
}
