import type { AttendanceStatusToken } from "@bhw/design-tokens";
import { isKioskQr, scanRequestSchema, type ScanSuccess } from "@bhw/types";
import { useQueryClient } from "@tanstack/react-query";
import * as Application from "expo-application";
import type { BarcodeScanningResult } from "expo-camera";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, View } from "react-native";

import { Spinner } from "@/components/gluestack/spinner";
import { SCAN_COPY } from "@/components/scan/copy";
import { HealthCheckSheet } from "@/components/scan/health-check-sheet";
import { ScanResultOverlay } from "@/components/scan/scan-result-overlay";
import { ScannerCamera } from "@/components/scan/scanner-camera";
import { SelfieCapture, useSelfieRequired } from "@/components/scan/selfie-capture";
import { useScanHealth } from "@/components/scan/use-scan-health";
import { Text } from "@/components/ui/text";
import { callFunction, reportError } from "@/lib/api";
import { getInstallationId } from "@/lib/device-id";
import { usePreferences } from "@/lib/preferences";
import { dtrKeys } from "@/lib/queries/dtr";
import { historyKeys } from "@/lib/queries/history";
import { HOME_QUERY_KEY, manilaToday } from "@/lib/queries/home";
import { toScanResultView, type ScanResponse, type ScanResultView } from "@/lib/scan-result";
import { useSession } from "@/lib/session";
import { useOnline } from "@/lib/use-online";

type Phase = "health" | "selfie" | "scanning" | "submitting" | "result";

interface ShownResult {
  view: ScanResultView;
  ok: boolean;
  status?: AttendanceStatusToken;
}

/** Successful scans close the overlay and return to Home after this delay. */
const AUTO_DISMISS_MS = 4000;
const NOTICE_MS = 2500;

type ScanSuccessBody = Omit<ScanSuccess, "ok">;

/**
 * Scan (core flow 4): pre-scan health check → camera → record-attendance → animated result.
 *
 * NEVER queue or retry scans offline (docs/phase-5-mobile/README.md §3 "Offline"; BR-02, BR-40;
 * decision D-12 in docs/phase-1-system-analysis): a kiosk QR expires 30 s after it is issued and
 * the server records attendance with its OWN clock, so a scan sent later could never be valid —
 * it would only fail as QR_EXPIRED (or be recorded at the wrong time). Offline the FAB is
 * disabled, the health check blocks "Start scanning", and a scan that loses the network shows
 * the OFFLINE message so the employee scans again at the kiosk. Nothing is stored for later.
 */
export default function ScanScreen() {
  const { deviceId, signOut, session } = useSession();
  const selfieRequired = useSelfieRequired().data === true;
  // Path of the selfie taken for this scan (only when app_settings.selfie_required is on).
  const selfie = useRef<string | null>(null);
  const { lang } = usePreferences();
  const online = useOnline();
  const queryClient = useQueryClient();
  const health = useScanHealth();
  const c = SCAN_COPY[lang];

  const [phase, setPhase] = useState<Phase>("health");
  const [result, setResult] = useState<ShownResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Synchronous lock: the camera can fire several callbacks for one QR before React re-renders.
  const handled = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const leave = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, []);

  const show = useCallback(
    (response: ScanResponse) => {
      setResult({
        view: toScanResultView(response, lang),
        ok: response.ok,
        status: response.ok ? response.status : undefined,
      });
      setPhase("result");
      if (response.ok) {
        // A new time-in/out changes Home, History and the DTR.
        void queryClient.invalidateQueries({ queryKey: HOME_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: historyKeys.all });
        void queryClient.invalidateQueries({ queryKey: dtrKeys.all });
      }
    },
    [lang, queryClient],
  );

  const submit = useCallback(
    async (token: string) => {
      try {
        // Offline: tell the user now; the scan is NOT kept for later (see the comment above).
        if (!online) {
          show({ ok: false, code: "OFFLINE" });
          return;
        }
        const position = await health.getScanPosition();
        if (!position) {
          show({ ok: false, code: "LOCATION_UNAVAILABLE" });
          return;
        }
        const body = {
          token: token.trim(),
          deviceId: deviceId ?? (await getInstallationId()),
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? health.inputs.maxAccuracy + 1,
          // Android/iOS mock-location flag: an anomaly signal for the admin, not a hard block.
          isMocked: position.mocked ?? false,
          appVersion: (Application.nativeApplicationVersion ?? "dev").slice(0, 20),
          ...(selfie.current ? { selfiePath: selfie.current } : {}),
        };
        const parsed = scanRequestSchema.safeParse(body);
        if (!parsed.success) {
          const field = parsed.error.issues[0]?.path[0];
          show({ ok: false, code: field === "token" ? "QR_INVALID" : field === "deviceId" ? "INTERNAL_ERROR" : "LOCATION_UNAVAILABLE" });
          if (field === "deviceId") void reportError("Scan request had an invalid device id", { field });
          return;
        }

        const res = await callFunction<ScanSuccessBody>("record-attendance", parsed.data);
        show(
          res.ok
            ? {
                ok: true,
                action: res.action,
                time: res.time,
                status: res.status,
                minutesLate: res.minutesLate,
                undertimeMinutes: res.undertimeMinutes,
                stationName: res.stationName,
              }
            : { ok: false, code: res.code, params: res.params },
        );
      } catch (e) {
        void reportError("Scan failed unexpectedly", { error: e instanceof Error ? e.message : String(e) });
        show({ ok: false, code: "INTERNAL_ERROR" });
      }
    },
    [online, health, deviceId, show],
  );

  const onScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (handled.current) return;
      if (!isKioskQr(data)) {
        // Any other QR (personal QR, a URL…) is ignored; keep scanning.
        setNotice(c.notKioskQr);
        if (noticeTimer.current) clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
        return;
      }
      // First valid read: stop scanning and send it exactly once.
      handled.current = true;
      setNotice(null);
      setPhase("submitting");
      void submit(data);
    },
    [c.notKioskQr, submit],
  );

  const startScanning = useCallback(() => {
    handled.current = false;
    setResult(null);
    // The selfie is taken before the QR so it never uses up the QR's 30-second lifetime.
    if (selfieRequired && !selfie.current) {
      setPhase("selfie");
      return;
    }
    setPhase("scanning");
  }, [selfieRequired]);

  const onAction = useCallback(
    (action: ScanResultView["action"]) => {
      switch (action) {
        case "retry":
          if (health.ready) startScanning();
          else {
            setResult(null);
            setPhase("health");
          }
          break;
        case "settings":
          setResult(null);
          setPhase("health");
          void Linking.openSettings();
          break;
        case "correction":
          router.replace({ pathname: "/correction/new", params: { date: manilaToday() } });
          break;
        case "login":
          void signOut();
          break;
        default:
          break;
      }
    },
    [health.ready, startScanning, signOut],
  );

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <ScannerCamera
        lang={lang}
        cameraReady={health.cameraGranted}
        scanning={phase === "scanning"}
        notice={notice ?? (health.cameraGranted ? null : c.cameraNeeded)}
        onScanned={onScanned}
        onCancel={leave}
      />

      {phase === "submitting" ? (
        <View className="absolute inset-0 items-center justify-center gap-3 bg-black/70" accessibilityLiveRegion="polite">
          <Spinner size="large" className="text-brand" />
          <Text className="text-white">{c.sending}</Text>
        </View>
      ) : null}

      <HealthCheckSheet
        isOpen={phase === "health"}
        lang={lang}
        items={health.items}
        inputs={health.inputs}
        ready={health.ready}
        onFix={(item) => void health.fix(item)}
        onStart={startScanning}
        onCancel={leave}
      />

      {phase === "selfie" && session ? (
        <SelfieCapture
          lang={lang}
          userId={session.user.id}
          manilaDate={manilaToday()}
          onCaptured={(path) => {
            selfie.current = path;
            handled.current = false;
            setPhase("scanning");
          }}
          onCancel={leave}
        />
      ) : null}

      <ScanResultOverlay
        view={phase === "result" && result ? result.view : null}
        lang={lang}
        status={result?.status}
        autoDismissMs={result?.ok ? AUTO_DISMISS_MS : undefined}
        onAction={onAction}
        onClose={leave}
      />
    </View>
  );
}
