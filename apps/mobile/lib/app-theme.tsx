import { useColorScheme } from "nativewind";
import React, { createContext, useContext, useMemo } from "react";

import { toThemeName, type ThemeName } from "./theme";

/**
 * App theme context: the ONE place the color scheme is decided.
 *
 * NativeWind's useColorScheme is the source of truth because NativeWind is the styling foundation:
 * it follows the system setting by default, and `setColorScheme` switches every `.dark` CSS variable
 * at once. Paper, Tamagui, gluestack and the navigation theme all read `scheme` from this context,
 * so the five UI libraries can never disagree about light/dark.
 */
type AppTheme = {
  scheme: ThemeName;
  isDark: boolean;
  /** "system" follows the phone setting again (used by the Phase 5 Settings screen). */
  setScheme: (value: ThemeName | "system") => void;
  toggleScheme: () => void;
};

const AppThemeContext = createContext<AppTheme | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const { colorScheme, setColorScheme, toggleColorScheme } = useColorScheme();
  const scheme = toThemeName(colorScheme);

  const value = useMemo<AppTheme>(
    () => ({
      scheme,
      isDark: scheme === "dark",
      setScheme: setColorScheme,
      toggleScheme: toggleColorScheme,
    }),
    [scheme, setColorScheme, toggleColorScheme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const ctx = useContext(AppThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used inside <AppThemeProvider> (app/_layout.tsx)");
  return ctx;
}
