import * as LocalAuthentication from "expo-local-authentication";
import { useEffect, useState } from "react";

import { L } from "@/components/history/strings";
import { Text } from "@/components/ui/text";
import type { Lang } from "@/lib/messages";
import { usePreferences } from "@/lib/preferences";

import { SwitchRow } from "./settings-parts";

/**
 * Biometric unlock toggle (D-30: checked on the phone only, nothing is sent to the server).
 * Offered only when the phone has the hardware AND a fingerprint/face is enrolled; turning it on
 * asks for one successful check first so the user cannot lock themselves out.
 */
export function BiometricToggle({ lang }: { lang: Lang }) {
  const s = L[lang];
  const { biometricUnlock, setBiometricUnlock } = usePreferences();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const ok = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
        if (mounted) setAvailable(ok);
      } catch {
        if (mounted) setAvailable(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onChange = async (next: boolean) => {
    setMessage(null);
    if (!next) {
      setBiometricUnlock(false);
      return;
    }
    setBusy(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: s.biometricPrompt,
        cancelLabel: lang === "fil" ? "Kanselahin" : "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) setBiometricUnlock(true);
      else setMessage(s.biometricFailed);
    } catch {
      setMessage(s.biometricFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SwitchRow
        label={s.biometric}
        hint={available === false ? s.biometricUnavailable : s.biometricHint}
        value={biometricUnlock}
        // Always allow turning it OFF (e.g. fingerprints were removed from the phone).
        disabled={busy || available === null || (available === false && !biometricUnlock)}
        onValueChange={(v) => void onChange(v)}
      />
      {message ? (
        <Text accessibilityLiveRegion="polite" className="text-xs text-destructive">
          {message}
        </Text>
      ) : null}
    </>
  );
}
