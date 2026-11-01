import { useState } from "react";
import { Snackbar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePreferences } from "@/lib/preferences";
import { useOnline } from "@/lib/use-online";

const DISMISS = { en: "OK", fil: "Sige" } as const;

/**
 * App-wide offline notice (React Native Paper Snackbar — Paper's only jobs are FAB, Snackbar and
 * SegmentedButtons). Rendered once in app/_layout.tsx. It sits at the top, under the status bar,
 * so it never covers the bottom tabs or the Scan FAB. Dismissing it hides it until the next time
 * the phone goes offline.
 */
export function OfflineSnackbar() {
  const online = useOnline();
  const { t, lang } = usePreferences();
  const insets = useSafeAreaInsets();
  const [dismissed, setDismissed] = useState(false);
  const [wasOnline, setWasOnline] = useState(online);

  // Coming back online re-arms the notice for the next disconnect (state adjusted during render).
  if (online !== wasOnline) {
    setWasOnline(online);
    if (online) setDismissed(false);
  }

  return (
    <Snackbar
      visible={!online && !dismissed}
      onDismiss={() => setDismissed(true)}
      duration={Number.POSITIVE_INFINITY}
      action={{ label: DISMISS[lang], onPress: () => setDismissed(true) }}
      wrapperStyle={{ top: insets.top + 8, bottom: undefined }}
      accessibilityLiveRegion="polite"
      testID="offline-snackbar"
    >
      {t("offline")}
    </Snackbar>
  );
}
