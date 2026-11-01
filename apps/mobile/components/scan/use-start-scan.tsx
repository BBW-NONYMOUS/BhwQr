import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import { useCallback, useRef } from "react";

import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/gluestack/toast";
import { HOME_COPY } from "@/components/home/copy";
import { reportError } from "@/lib/api";
import { errorMessage } from "@/lib/messages";
import { usePreferences } from "@/lib/preferences";

/**
 * Scan FAB action (core flow 4): optional phone biometric unlock, then the Scan screen.
 * Biometrics are checked by the phone OS only (expo-local-authentication); nothing biometric is
 * stored or sent (AC: no biometric data is stored). A failed check returns to Home with a toast.
 */
export function useStartScan(): () => Promise<void> {
  const { biometricUnlock, lang, t } = usePreferences();
  const toast = useToast();
  const busy = useRef(false);

  const showBiometricFailed = useCallback(() => {
    toast.show({
      placement: "top",
      duration: 4000,
      render: ({ id }) => (
        <Toast nativeID={`toast-${id}`} action="error" variant="solid" accessibilityLiveRegion="assertive">
          <ToastTitle>{t("scan")}</ToastTitle>
          <ToastDescription>{errorMessage("BIOMETRIC_FAILED", lang)}</ToastDescription>
        </Toast>
      ),
    });
  }, [toast, lang, t]);

  return useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (biometricUnlock) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: HOME_COPY[lang].biometricPrompt,
          cancelLabel: lang === "fil" ? "Kanselahin" : "Cancel",
          disableDeviceFallback: false,
        });
        if (!result.success) {
          showBiometricFailed();
          return;
        }
      }
      router.push("/scan");
    } catch (e) {
      void reportError("Biometric unlock failed unexpectedly", { error: e instanceof Error ? e.message : String(e) });
      showBiometricFailed();
    } finally {
      busy.current = false;
    }
  }, [biometricUnlock, lang, showBiometricFailed]);
}
