/**
 * gluestack UI v2 provider, adapted for the BHW token setup.
 *
 * Differences from the stock v2 file (components/ui/gluestack-ui-provider):
 *  - No `config.ts` palette with vars(): gluestack components here use the shared token classes
 *    (bg-card, text-foreground, border-border, ...) whose CSS variables live in global.css.
 *  - It does NOT call NativeWind's setColorScheme(mode). The app theme context in app/_layout.tsx
 *    owns the color scheme; calling setColorScheme("light"/"dark") here would pin the scheme and
 *    stop the app from following the system setting.
 * It still mounts OverlayProvider (Actionsheet, modals) and ToastProvider (useToast).
 */
import { OverlayProvider } from "@gluestack-ui/overlay";
import { ToastProvider } from "@gluestack-ui/toast";
import React from "react";
import { View, type ViewProps } from "react-native";

export type ModeType = "light" | "dark";

export function GluestackUIProvider({
  mode,
  style,
  children,
}: {
  mode: ModeType;
  children?: React.ReactNode;
  style?: ViewProps["style"];
}) {
  return (
    <View
      // `dark` class only matters on web; on native NativeWind resolves .dark variables from its color scheme.
      className={mode === "dark" ? "dark flex-1" : "flex-1"}
      style={[{ flex: 1, height: "100%", width: "100%" }, style]}
    >
      <OverlayProvider>
        <ToastProvider>{children}</ToastProvider>
      </OverlayProvider>
    </View>
  );
}
