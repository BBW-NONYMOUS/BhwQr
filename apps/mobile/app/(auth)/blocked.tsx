import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BlockedView } from "@/components/auth/blocked-view";
import { LanguageToggle } from "@/components/auth/language-toggle";
import { usePreferences } from "@/lib/preferences";
import { useSession } from "@/lib/session";

/**
 * Blocked (core flow 2, AC-01): pending / rejected (+ reason) / inactive / not an employee /
 * account bound to another phone. The only ways out are Logout or, when the server state can
 * change (approval, reactivation, device reset), "Check again".
 */
export default function BlockedScreen() {
  const { gate, signOut, refresh } = useSession();
  const { lang } = usePreferences();
  const [busy, setBusy] = useState(false);

  // The root gate only routes here when blocked; fall back to "pending" during the redirect frame.
  const reason = gate.kind === "blocked" ? gate.reason : "pending";
  const detail = gate.kind === "blocked" ? gate.detail : null;

  const run = (action: () => Promise<void>) => {
    setBusy(true);
    void action().finally(() => setBusy(false));
  };

  return (
    <SafeAreaView className="flex-1 bg-background-subtle" edges={["top", "bottom"]}>
      <View className="items-end px-4 pt-2">
        <LanguageToggle />
      </View>
      <BlockedView
        reason={reason}
        detail={detail}
        lang={lang}
        busy={busy}
        onLogout={() => run(signOut)}
        onCheckAgain={() => run(refresh)}
      />
    </SafeAreaView>
  );
}
